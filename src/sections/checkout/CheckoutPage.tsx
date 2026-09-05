'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Overline } from '@/components/ui/Overline';
import { ProductImage } from '@/components/ui/ProductImage';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { getBrowserClient } from '@/lib/supabase-browser';
import { notifyNewOrder, calculateShipping, checkoutRateGate } from '@/app/checkout/actions';
import { captureAbandonedCart } from '@/app/checkout/abandoned-cart-actions';
import { checkReferralDiscount } from '@/app/checkout/rewards-actions';
import { postOrderDestination } from '@/lib/checkout-routing';
import { vendorFreeShippingEligible } from '@/lib/vendor-shipping';
import { PK_CITIES, normalizeCity, provinceForCity } from '@/lib/pk-cities';
import { CityCombobox } from '@/components/checkout/CityCombobox';
import { brandPlusName } from '@/lib/product-display';
import { hasWhatsApp, whatsappGoUrl } from '@/lib/whatsapp';
import { RETURNS_WINDOW_DAYS } from '@/lib/commerce';
import { useCommerceSettings } from '@/context/CommerceSettings';
import { track } from '@/lib/analytics';
import { computeCouponDiscount } from '@/lib/coupon-validation';
import { useAutomaticDiscount } from '@/lib/use-automatic-discount';
import { successHaptic } from '@/lib/haptics';
import { readAttribution } from '@/lib/attribution';
import { readReferral } from '@/lib/referral';
import { BankAccountsList } from '@/components/checkout/BankAccountsList';
import { JazzCashQrPanel } from '@/components/checkout/JazzCashQrPanel';
import type { CartItem, Coupon, PayMethod, LoyaltyAccount, BankAccount } from '@/types';

const PROVINCES = ['Punjab', 'Sindh', 'KPK', 'Balochistan', 'Islamabad', 'AJK', 'Gilgit-Baltistan'];

const PAY_METHODS: ReadonlyArray<[PayMethod, string, string]> = [
  ['cod',       'Cash on Delivery (COD)', 'Pay when your order arrives'],
  ['jazzcash',  'JazzCash',               'Pay with JazzCash mobile wallet'],
  ['easypaisa', 'Easypaisa',              'Pay with Easypaisa mobile wallet'],
  ['card',      'Credit / Debit Card',    'Visa, Mastercard via JazzCash'],
  ['bank',      'Bank Transfer',          'Direct bank deposit'],
  ['jazzcash_qr', 'JazzCash / Raast QR',  'Scan and pay from any bank or wallet app'],
];

function makeOrderNumber() {
  // Timestamp + 4 crypto-random chars. The DB has a UNIQUE constraint on
  // order_number as the backstop; handleSubmit retries with a fresh number
  // if two checkouts ever do collide.
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  let rand = '';
  for (const b of bytes) rand += alphabet[b % alphabet.length];
  return 'YP-' + Date.now().toString(36).slice(-5).toUpperCase() + rand;
}

function isDuplicateOrderNumber(message: string): boolean {
  return message.includes('duplicate key') || message.includes('23505');
}

// Server-resolved props from /checkout/page.tsx, which payment methods
// the merchant has enabled in admin settings, plus the bank-transfer
// instructions to show on the thank-you page.
interface CheckoutPageProps {
  enabledMethods?: PayMethod[];
  bankAccounts?: BankAccount[];
  bankNotes?: string;
  /** Pre-encoded modules of the shop's scan-to-pay code (server-side encoder). */
  jazzQrRows?: string[] | null;
  jazzQrTitle?: string;
  jazzQrNotes?: string;
  /** Error code a gateway callback bounced back with
   *  (`/checkout?error=payment_failed|signature|payment_config|order_missing`).
   *  Triggers the payment-failed banner + cart restore below. */
  paymentError?: string | null;
  /** Order number of the failed payment, when the callback knew it. */
  failedOrder?: string | null;
  /** Active seasonal-sale coupon code (e.g. AZADI14 during the Azadi window).
   *  Shown as a one-tap suggestion in the coupon box — NEVER auto-applied
   *  (owner decision 4 Aug: the shopper chooses). The tap runs the same
   *  validation path as typing the code. */
  seasonalCoupon?: string | null;
}

// The cart is cleared right before the browser POSTs off to JazzCash /
// Easypaisa. This key holds a snapshot of what was cleared so a failed
// payment can put the bag back instead of dead-ending on "Your bag is empty".
const GATEWAY_SNAPSHOT_KEY = 'yp_gateway_cart';
// A snapshot older than this is stale history, not an in-flight payment —
// don't resurrect last week's bag because an old ?error= URL was revisited.
const GATEWAY_SNAPSHOT_TTL_MS = 6 * 60 * 60 * 1000;


// House icon rules (AGENTS.md): inline SVG, lucide-style, never emoji.
const LockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const CheckIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export function CheckoutPage({ enabledMethods, bankAccounts = [], bankNotes, jazzQrRows = null, jazzQrTitle = '', jazzQrNotes = '', paymentError = null, failedOrder = null, seasonalCoupon = null }: CheckoutPageProps = {}) {
  const { cartItems, clearCart, restoreCart, removeFromCart, updateQty, appliedCoupon: cartCoupon, setAppliedCoupon } = useCart();
  const { user } = useAuth();
  const router = useRouter();

  // Filter the hard-coded PAY_METHODS by what's actually enabled in admin
  // settings. If `enabledMethods` is undefined (server didn't pass one, e.g.
  // demo mode), default to all on, same as before this prop existed.
  const visiblePayMethods = enabledMethods && enabledMethods.length > 0
    ? PAY_METHODS.filter(([m]) => enabledMethods.includes(m))
    : PAY_METHODS;

  // Default to the first enabled method so we never auto-select a hidden one.
  const defaultMethod: PayMethod = visiblePayMethods[0]?.[0] ?? 'cod';
  const [payMethod, setPayMethod] = useState<PayMethod>(defaultMethod);
  // One `fullName` field, not First/Last: COD needs four facts (name, phone,
  // address, city) and every extra visible input reads as "long form" to the
  // 82%-mobile audience. handleSubmit splits it back into the first/last
  // columns place_order stores.
  const [formData, setFormData] = useState({ email: '', fullName: '', phone: '', address: '', city: '', province: '', zip: '' });
  // Postal code lives behind a disclosure: optional, submits '' untouched.
  // Province is a required, always-visible select (Aug 5 checkout audit):
  // it is the one field that guarantees correct zone pricing — city
  // inference only covers the 48 mapped cities and silently fell back to
  // the first active zone for every other town.
  const [moreAddress, setMoreAddress] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  // One order number per checkout session + the set of numbers actually
  // sent to the server (own-collision recovery, see handleSubmit).
  const orderNumberRef = useRef('');
  const sentOrderNumbers = useRef<Set<string>>(new Set());
  // The applied coupon lives in CartProvider (persisted to localStorage), so a
  // coupon added on /cart survives the trip to checkout, including a refresh
  // or full page load. `couponCode` is just the local text-input value.
  const [couponCode, setCouponCode] = useState(cartCoupon?.code ?? '');
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  // Optimistic first render from the owner's live free-shipping setting, so a
  // qualifying cart shows FREE immediately instead of flashing "PKR 200"
  // before calculateShipping resolves. The effect below corrects it against
  // the real zone/rate config (and the customer's province).
  const { freeShippingEnabled, freeShippingThreshold, defaultShippingRate, loyaltyPkrPerPoint, vendorFreeShipThresholds } = useCommerceSettings();
  const [shippingInfo, setShippingInfo] = useState<{ rate: number; free: boolean; label: string; estimatedDays?: { min: number; max: number } | null }>(() => {
    const sub = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
    const free =
      (freeShippingEnabled && sub >= freeShippingThreshold) ||
      // Vendor rule (NB Sons ≥ Rs 1,999): qualify optimistically too, so a
      // vendor-qualified basket never flashes a paid rate it won't be charged.
      vendorFreeShippingEligible(cartItems, vendorFreeShipThresholds);
    return free
      ? { rate: 0, free: true, label: 'Standard' }
      : { rate: defaultShippingRate, free: false, label: 'Standard' };
  });

  // ─── Rewards: loyalty points ────────────────────────────────────────────
  // Gift-card and referral redemption are hidden from checkout until those
  // programmes have a customer-facing way to obtain a code, the server
  // actions remain in place for when they do.
  // Referral first-order discount, offered when the shopper landed via
  // someone's ?ref= link (lib/referral persists it 30 days). Eligibility is
  // identity-dependent (must be their FIRST order by user/email/phone), so
  // it's re-checked server-side as those fields fill in; place_order
  // re-validates through the same SQL rules at submit.
  const [referralOffer, setReferralOffer] = useState<{ code: string; pct: number } | null>(null);

  const [loyalty, setLoyalty]               = useState<LoyaltyAccount | null>(null);
  const [pointsRedeemInput, setPointsRedeemInput] = useState<number | ''>('');
  const [pointsRedeem, setPointsRedeem]     = useState(0);

  // Pull loyalty balance for signed-in users, the Supabase query is an
  // external system, so syncing the result into React state is the
  // documented exception to the no-setState-in-effect rule.
  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoyalty(null);
      return;
    }
    const sb = getBrowserClient();
    sb.from('loyalty_accounts').select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setLoyalty(data as LoyaltyAccount | null));
  }, [user]);

  // The cart hydrates from localStorage in CartProvider's mount effect, so an
  // empty `cartItems` during SSR / the first client render doesn't yet mean
  // the bag is empty. Flip `hydrated` in an effect (which flushes in the same
  // pass as the provider's load effect) so the empty-bag state below only
  // shows once we genuinely know there's nothing to check out.
  const [hydrated, setHydrated] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setHydrated(true); }, []);

  // Failed-payment recovery (audit H1): the cart was cleared before the
  // gateway hop, so when the callback bounces back with ?error=… the shopper
  // used to land on "Your bag is empty" with no way to retry. Restore the
  // pre-gateway snapshot (saved in handleSubmit below) into the empty cart —
  // silently, this is undoing our own clear, not a user add. Runs once, after
  // the cart has hydrated so we never clobber a bag the shopper rebuilt.
  const restoredAfterFailure = useRef(false);
  useEffect(() => {
    if (!paymentError || !hydrated || restoredAfterFailure.current) return;
    restoredAfterFailure.current = true;
    if (cartItems.length > 0) return; // bag intact — the banner alone is enough
    try {
      const raw = localStorage.getItem(GATEWAY_SNAPSHOT_KEY);
      if (!raw) return;
      const snap = JSON.parse(raw) as { order?: string; items?: CartItem[]; coupon?: Coupon | null; ts?: number };
      // Only restore the bag that belongs to THIS failed payment, and only
      // while it's plausibly still in flight.
      if (failedOrder && snap.order && snap.order !== failedOrder) return;
      if (typeof snap.ts === 'number' && Date.now() - snap.ts > GATEWAY_SNAPSHOT_TTL_MS) return;
      if (Array.isArray(snap.items) && snap.items.length > 0 && restoreCart(snap.items)) {
        if (snap.coupon) setAppliedCoupon(snap.coupon);
        localStorage.removeItem(GATEWAY_SNAPSHOT_KEY);
      }
    } catch { /* corrupt snapshot — keep the banner, skip the restore */ }
    // restoreCart/setAppliedCoupon are stable enough here: the run-once ref
    // guard means re-renders can't double-restore.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentError, failedOrder, hydrated, cartItems.length]);

  // begin_checkout marks *reaching* checkout, not submitting it (GA4 spec).
  // Firing on submit conflated "started checkout" with "completed checkout"
  // and made the funnel skip this step for everyone who bailed (#193). Fires
  // once per page visit, after the cart has hydrated from localStorage.
  // Focus the first REQUIRED field (phone) on mount so the customer can start
  // typing without a tap — but only on fine-pointer devices. On phones the
  // autofocus popped the keyboard the instant the page opened, covering the
  // order summary the shopper was trying to review.
  const phoneRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) phoneRef.current?.focus();
  }, []);

  const beganCheckout = useRef(false);
  useEffect(() => {
    if (beganCheckout.current || cartItems.length === 0) return;
    beganCheckout.current = true;
    track({
      name: 'begin_checkout',
      payload: {
        value: cartItems.reduce((s, i) => s + i.price * i.qty, 0),
        currency: 'PKR',
        items: cartItems.map(i => ({
          product_id: i.id, slug: i.slug, product_name: i.name, brand: i.brand ?? undefined,
          category: i.category, variant: i.variant_label ?? i.variant,
          price: i.price, qty: i.qty, currency: 'PKR',
        })),
      },
    });
  }, [cartItems]);

  const subtotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  // Automatic discounts: the best eligible one applies by itself when no code
  // has been typed (a manual code always wins — the hook returns null then).
  // The order is placed with the automatic's internal code, so place_order's
  // hardened path (drift check, caps, ledger) works unchanged.
  const autoDiscount = useAutomaticDiscount(cartItems, subtotal, cartCoupon);
  const effectiveCoupon = cartCoupon ?? autoDiscount?.coupon ?? null;
  // Free-shipping coupons waive the delivery charge instead of discounting
  // the line total (place_order validates exactly this: discount 0, shipping
  // 0 accepted because the server only rejects undercharges vs its floor).
  const freeShipCoupon = Boolean(effectiveCoupon && (effectiveCoupon.discount_type === 'free_shipping' || effectiveCoupon.free_shipping));
  // Shared maths with the cart and place_order (which re-derives the same
  // number and rejects drift): scoped coupons discount only their own lines.
  const couponDiscount = cartCoupon
    ? computeCouponDiscount(cartCoupon, cartItems)
    : (autoDiscount?.discount ?? 0);
  // Referral first-order discount: a coupon always wins (they don't stack —
  // place_order validates exactly one discount source), so the referral line
  // only applies when no coupon — typed OR automatic — is in play.
  const referralDiscount = !effectiveCoupon && referralOffer
    ? Math.round(subtotal * referralOffer.pct / 100)
    : 0;
  const discount = couponDiscount > 0 ? couponDiscount : referralDiscount;
  const lineTotal = Math.max(0, subtotal - discount);
  const shipping = freeShipCoupon ? 0 : shippingInfo.rate;
  const beforeRewards = lineTotal + shipping;

  // Loyalty points redemption. `pointsRedeem` is a raw points count, converted
  // to a PKR discount using the admin-configured rate (Settings → Loyalty →
  // "PKR per point at redemption", defaults to 1:1), capped at the payable
  // amount. `pointsToDebit` is the actual integer points spent server-side,
  // rounded up just enough to cover the (possibly-capped) discount, never more
  // than the customer asked to redeem.
  const pointsDiscount = Math.min(pointsRedeem * loyaltyPkrPerPoint, beforeRewards);
  const pointsToDebit  = loyaltyPkrPerPoint > 0
    ? Math.min(pointsRedeem, Math.ceil(pointsDiscount / loyaltyPkrPerPoint))
    : 0;
  const total = Math.max(0, beforeRewards - pointsDiscount);

  // Referral eligibility, debounced against the identity fields. Requires at
  // least one identity signal (phone/email/user) before asking, so a
  // returning guest never sees a discount line that vanishes once their
  // number identifies them. Coupons win over referrals (they don't stack).
  useEffect(() => {
    const code = readReferral();
    if (!code || effectiveCoupon) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReferralOffer(null);
      return;
    }
    const phone = formData.phone.trim();
    const email = formData.email.trim();
    if (!phone && !email && !user) {
       
      setReferralOffer(null);
      return;
    }
    const t = setTimeout(() => {
      void checkReferralDiscount({ code, email: email || null, phone: phone || null, userId: user?.id ?? null })
        .then(res => setReferralOffer(res.eligible ? { code, pct: res.discount_pct } : null))
        .catch(() => setReferralOffer(null));
    }, 800);
    return () => clearTimeout(t);
  }, [formData.phone, formData.email, user, effectiveCoupon]);

  // Recompute shipping whenever subtotal or province changes (requoteTick
  // forces a re-quote after a server-side undercharge rejection).
  const [shippingLoading, setShippingLoading] = useState(false);
  const [requoteTick, setRequoteTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (subtotal === 0) return;
      setShippingLoading(true);
      // Free shipping is earned on what the customer actually pays for the
      // merchandise (subtotal minus the coupon/referral discount) — owner
      // directive 2026-09-01: a coupon that drops the order below the
      // threshold also takes the free-delivery promise with it. place_order
      // enforces the same discounted figure server-side at submit. Items go
      // along for the vendor rule (NB Sons ≥ Rs 1,999 ships free).
      try {
        const res = await calculateShipping({
          province: formData.province || undefined,
          subtotal: Math.max(0, subtotal - discount),
          // `id` lets the server re-resolve vendor_id from the products table,
          // so lines saved by older storefront code (no vendor_id) still count.
          items: cartItems.map(i => ({ id: i.id, vendor_id: i.vendor_id ?? null, price: i.price, qty: i.qty })),
        });
        if (!cancelled) setShippingInfo(res);
      } catch {
        // Server quote unreachable: fall back to the optimistic default so
        // the shopper is never stuck on a spinner. place_order re-validates;
        // its undercharge rejection maps to a friendly re-quote message.
        if (!cancelled) {
          const free =
            (freeShippingEnabled && Math.max(0, subtotal - discount) >= freeShippingThreshold) ||
            vendorFreeShippingEligible(cartItems, vendorFreeShipThresholds);
          setShippingInfo({ rate: free ? 0 : defaultShippingRate, free, label: 'Standard' });
        }
      } finally {
        if (!cancelled) setShippingLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // cartItems is intentionally keyed by subtotal: any change that affects the
    // vendor rule also changes the subtotal. `discount` is a dep because the
    // free-delivery threshold is judged on the discounted subtotal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, discount, formData.province, requoteTick]);

  // Capture abandoned-cart snapshot when the user supplies a phone OR an
  // email AND the cart is non-empty. Phone is the FIRST checkout field, so
  // keying on it catches the COD shopper who bails before typing an email —
  // those rows feed the admin's WhatsApp follow-up queue, while email rows
  // (also) get the automated reminder emails. Debounced 1.2 s so we don't
  // fire per keystroke.
  useEffect(() => {
    if (cartItems.length === 0) return;
    const email = formData.email.trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const phoneOk = formData.phone.replace(/\D+/g, '').length >= 10;
    if (!emailOk && !phoneOk) return;
    const t = setTimeout(() => {
      void captureAbandonedCart({
        email: emailOk ? email : null,
        phone: phoneOk ? formData.phone : null,
        first_name: formData.fullName.trim().split(/\s+/)[0] || null,
        items: cartItems,
        subtotal,
        user_id: user?.id ?? null,
      });
    }, 1200);
    return () => clearTimeout(t);
  }, [formData.email, formData.phone, formData.fullName, cartItems, subtotal, user?.id]);

  const update = (key: string, val: string) => {
    setFormData(p => ({ ...p, [key]: val }));
    if (errors[key]) setErrors(p => { const n = { ...p }; delete n[key]; return n; });
  };

  // Province auto-inference from the (required) city. The July 25 four-field
  // form hid the province select behind an optional toggle, which nobody
  // opens — every order since arrived with province='' and the shipping
  // resolver fell back to the cheapest zone (Sindh/KPK undercharged Rs 100,
  // Zone 3 Rs 200, and ETAs wrong). Deriving it from the city keeps the
  // short form AND restores zone pricing. A province the shopper picked by
  // hand is never overwritten (provinceTouched); an auto-filled one keeps
  // tracking the city until they touch the select.
  const provinceTouched = useRef(false);
  const updateCity = (val: string) => {
    setFormData(p => {
      const inferred = provinceForCity(val);
      const province = provinceTouched.current ? p.province : (inferred ?? p.province);
      return { ...p, city: val, province };
    });
    if (errors.city) setErrors(p => { const n = { ...p }; delete n.city; return n; });
  };

  // City suggestions narrow to the picked province (all when none picked).
  const cityOptions = formData.province
    ? PK_CITIES.filter(c => provinceForCity(c) === formData.province)
    : [...PK_CITIES];

  // Field key → the input's DOM id, in the form's visual order, so a failed
  // submit can take the shopper TO the first problem.
  const FIELD_IDS: [string, string][] = [
    ['phone', 'co-phone'], ['fullName', 'co-name'],
    ['province', 'co-province'], ['city', 'co-city'],
    ['address', 'co-address'], ['email', 'co-email'],
  ];

  // Split the single name field back into the first/last columns the orders
  // table stores. One-word names get an empty last name (the column is NOT
  // NULL but accepts '').
  const splitName = () => {
    const parts = formData.fullName.trim().split(/\s+/);
    return { first: parts[0] ?? '', last: parts.slice(1).join(' ') };
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.fullName.trim()) e.fullName = 'Required';
    const phone = formData.phone.trim().replace(/[\s\-()]/g, '');
    if (!phone) {
      e.phone = 'Required';
    } else if (!/^(\+92|0092|0)?3\d{9}$/.test(phone)) {
      e.phone = 'Enter a valid Pakistani mobile number (e.g. 03001234567)';
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      e.email = 'Enter a valid email address';
    }
    if (!formData.address.trim()) e.address = 'Required';
    if (!formData.province) e.province = 'Required';
    if (!formData.city.trim()) e.city = 'Required';
    // Card/JazzCash/Easypaisa require an email so we can send payment confirmations.
    if ((payMethod === 'jazzcash' || payMethod === 'easypaisa' || payMethod === 'card') && !formData.email) {
      e.email = 'Required for online payment confirmation';
    }
    setErrors(e);
    if (Object.keys(e).length > 0) {
      // On phones the Place Order button sits a full screen below the form,
      // so inline errors used to render invisibly off-screen and the tap
      // looked dead — the fastest way to lose a COD checkout. Take the
      // shopper to the first problem and explain near the button too.
      setSubmitError('Please fix the highlighted fields above to place your order.');
      const first = FIELD_IDS.find(([key]) => e[key]);
      if (first) {
        const el = document.getElementById(first[1]);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (el as HTMLInputElement | null)?.focus({ preventScroll: true });
      }
      return false;
    }
    setSubmitError('');
    return true;
  };

  // Shared by the manual Apply button and the seasonal auto-apply below.
  // auto=true is silent: no spinners, and a failure (expired, restricted)
  // simply leaves the cart couponless instead of surfacing an error the
  // shopper never asked about.
  const applyCode = async (code: string, opts: { auto?: boolean } = {}) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    if (!opts.auto) { setCouponError(''); setCouponLoading(true); }
    const sb = getBrowserClient();
    // coupons has RLS with no anon SELECT (migration 070), go through the
    // SECURITY DEFINER lookup_coupon RPC instead of reading the table.
    const { data, error } = await sb.rpc('lookup_coupon' as never, { p_code: trimmed } as never);

    if (error) {
      if (!opts.auto) { setCouponLoading(false); setCouponError('Could not validate coupon. Try again.'); }
      return;
    }
    const rows = (data ?? []) as Coupon[];
    if (rows.length === 0) {
      if (!opts.auto) { setCouponLoading(false); setCouponError('Invalid or expired coupon code'); }
      return;
    }
    const c = rows[0];

    // Per-user usage cap, pull prior redemption count when we know the user.
    let perUserUsedCount: number | undefined;
    if (formData.email && typeof c.usage_limit_per_user === 'number' && c.usage_limit_per_user > 0) {
      const { count } = await sb.from('coupon_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('coupon_id', c.id).eq('email', formData.email);
      perUserUsedCount = count ?? 0;
    }

    if (!opts.auto) setCouponLoading(false);

    const { validateCoupon } = await import('@/lib/coupon-validation');
    const verdict = validateCoupon({
      coupon: c, cartItems, subtotal,
      email: formData.email ?? null,
      perUserUsedCount,
    });
    if (!verdict.ok) { if (!opts.auto) setCouponError(verdict.error); return; }
    setAppliedCoupon(c);
    setCouponCode(c.code);
  };

  const applyCoupon = () => applyCode(couponCode);

  // Seasonal-sale coupon OFFER (owner decision 4 Aug: never auto-apply — the
  // shopper chooses). When a seasonal window is open and no coupon is applied,
  // the coupon box shows a one-tap "Apply" suggestion (rendered below); the
  // tap runs the same non-silent path as typing the code.

  const handleSubmit = async () => {
    // Guard against double-submit: the button is disabled while `submitting`,
    // but a fast double-click can fire two handlers before React re-renders,     // and the rate-gate await below used to run with the button still live.
    if (submitting) return;
    if (!validate()) return;

    successHaptic();
    setSubmitting(true);
    setSubmitError('');

    // Fail OPEN: a dead rate limiter must never brick the button (the
    // rejection used to leave submitting=true forever).
    const rate = await checkoutRateGate().catch(() => ({ ok: true }));
    if (!rate.ok) {
      setSubmitError('Too many checkout attempts. Please wait a minute and try again.');
      setSubmitting(false);
      return;
    }

    try {
      const sb = getBrowserClient();
      // Order numbers are client-generated; the DB UNIQUE constraint is the
      // backstop. One number per checkout (ref): if a retry after a network
      // blip collides with OUR OWN already-sent number, the first attempt
      // actually succeeded — recover to the success path instead of placing
      // a duplicate order. Foreign collisions still mint fresh.
      if (!orderNumberRef.current) orderNumberRef.current = makeOrderNumber();
      let orderNumber = orderNumberRef.current;
      const name = splitName();
      // The RPC returns the stored order row; place_order may record LESS
      // shipping than quoted (it clamps to 0 when the order qualifies for
      // free delivery server-side — migration 780), so the emails must use
      // the server's figures, not the client quote.
      let placed: { shipping?: number; total?: number } | null = null;
      let recoveredOwnOrder = false;
      for (let attempt = 1; ; attempt++) {
        const sentBefore = sentOrderNumbers.current.has(orderNumber);
        sentOrderNumbers.current.add(orderNumber);
        const { data, error } = await sb.rpc('place_order' as never, {
          order_data: {
            order_number: orderNumber,
            email: formData.email || '',
            first_name: name.first,
            last_name: name.last,
            phone: formData.phone.trim(),
            address: formData.address,
            city: normalizeCity(formData.city),
            province: formData.province || '',
            zip: formData.zip || '',
            pay_method: payMethod,
            subtotal,
            shipping,
            total: beforeRewards,                  // pre-rewards order total, points decrement separately
            items: cartItems,
            status: 'pending',
            user_id: user?.id || '',
            // Typed code, or the applied automatic's internal code — either
            // way place_order re-validates and re-prices it server-side.
            coupon_code: effectiveCoupon?.code || '',
            discount_amount: discount,
            // Marketing attribution (UTM + first-touch landing/referrer) so the
            // order can be credited to the ad channel that drove it (ROAS).
            ...(readAttribution() ?? {}),
          },
          gift_card_code:   null,
          points_redeem:    pointsToDebit > 0 ? pointsToDebit : null,
          // Referral code captured from a ?ref=<code> landing link (lib/referral).
          // place_order stamps it onto the signed-in customer's profile so
          // award_referral_for_user can pay the referrer on first delivery.
          referred_by_code: readReferral(),
        } as never);
        if (!error) {
          const row = Array.isArray(data) ? data[0] : data;
          placed = (row ?? null) as { shipping?: number; total?: number } | null;
          break;
        }
        if (isDuplicateOrderNumber(error.message)) {
          if (sentBefore) {
            // Our own number, already sent in a prior invocation that we
            // never saw succeed: the order exists. Proceed as success.
            recoveredOwnOrder = true;
            break;
          }
          if (attempt < 3) {
            orderNumber = makeOrderNumber();
            orderNumberRef.current = orderNumber;
            continue;
          }
        }
        throw new Error(error.message);
      }
      // Correct the payable total by the server↔client shipping delta (0 when
      // they agree); rewards math (points) is untouched.
      const serverShipping = typeof placed?.shipping === 'number' ? placed.shipping : shipping;
      const payableTotal = Math.max(0, total - shipping + serverShipping);

      const dest = postOrderDestination(payMethod, orderNumber);

      if (dest.kind === 'gateway_post') {
        // Build a form and submit to the gateway initiator route.
        // The route handler returns an HTML auto-submit form that POSTs to the
        // real gateway. We POST as a form so the response can be a top-level
        // navigation (the browser shows the gateway's hosted page).
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = dest.url;
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'order_number';
        input.value = orderNumber;
        form.appendChild(input);
        document.body.appendChild(form);
        // Snapshot the bag before clearing it: if the gateway payment fails,
        // the callback lands on /checkout?error=… and the restore effect above
        // puts these items back so the shopper can retry (audit H1).
        try {
          localStorage.setItem(GATEWAY_SNAPSHOT_KEY, JSON.stringify({
            order: orderNumber, items: cartItems, coupon: cartCoupon, ts: Date.now(),
          }));
        } catch { /* quota exceeded — worst case the old dead-end, never block payment */ }
        clearCart();
        form.submit();
        return;
      }

      // COD / bank / gift_card path, fire customer + owner emails, then
      // thank-you. Skipped on own-collision recovery: the first (successful)
      // invocation may already have fired them — never send twice.
      if (!recoveredOwnOrder) void notifyNewOrder({
        order_number: orderNumber,
        email: formData.email || undefined,
        first_name: name.first,
        last_name: name.last,
        phone: formData.phone.trim(),
        city: normalizeCity(formData.city),
        province: formData.province || undefined,
        total: payableTotal,
        items: cartItems.map(i => ({
          name: i.name, qty: i.qty, price: i.price, brand: i.brand ?? undefined, variant: i.variant_label ?? i.variant,
          slug: i.slug,
        })),
        pay_method: payMethod,
      });
      // NOTE: the `purchase` analytics event is intentionally NOT fired here.
      // It's fired once on /thank-you (see app/thank-you/ThankYouPurchase.tsx),
      // which BOTH this COD path (router.push below) and gateway callbacks
      // reach — so every order fires exactly one client `purchase`, deduped on
      // the order number, with no COD double-count.
      clearCart();
      router.push(dest.url);
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      console.error('checkout submit failed:', raw);
      const lower = raw.toLowerCase();
      let msg: string;
      if (/fetch|network|connection|timeout|failed to load/.test(lower)) {
        msg = "Couldn't reach the server. Check your connection and tap Place Order again — your details are still here.";
      } else if (/shipping|undercharge|delivery/.test(lower)) {
        msg = 'Delivery charge for your area was updated — please tap Place Order again.';
        setRequoteTick(t => t + 1); // re-run the shipping quote effect
      } else {
        msg = 'Something went wrong placing your order. Please try again, or WhatsApp us and we will place it for you.';
      }
      setSubmitError(msg);
      setSubmitting(false);
    }
  };

  // Sticky mobile commit bar: at ≤860px the summary column (with the Place
  // Order button and total) stacks below the entire form, so the commit
  // button and price were invisible for the whole form-filling session.
  // The bar shows whenever the summary panel is off-screen and reuses the
  // same handleSubmit — validate() already scrolls to the first error.
  const summaryRef = useRef<HTMLDivElement>(null);
  const submitBtnRef = useRef<HTMLButtonElement>(null);
  const [showCommitBar, setShowCommitBar] = useState(false);
  useEffect(() => {
    // Observe the Place Order button itself (not the whole panel): the bar
    // should yield exactly when the real button is usable, with a little
    // slack above the bar's own height.
    const el = submitBtnRef.current ?? summaryRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => setShowCommitBar(!entry.isIntersecting),
      { threshold: 0.5, rootMargin: '0px 0px -70px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
    // Re-observe when the form mounts (the empty-bag state renders no panel).
  }, [hydrated, cartItems.length]);
  // Lift the WhatsApp FAB / back-to-top above the bar while it's visible
  // (same CSS-var contract as the PDP sticky buy bar).
  useEffect(() => {
    const root = document.documentElement;
    if (showCommitBar) root.style.setProperty('--fab-bottom-offset', '80px');
    else root.style.removeProperty('--fab-bottom-offset');
    return () => { root.style.removeProperty('--fab-bottom-offset'); };
  }, [showCommitBar]);

  const inputStyle = (key: string): React.CSSProperties => ({
    width: '100%', padding: '10px 12px',
    border: `1px solid ${errors[key] ? 'var(--error)' : 'var(--line)'}`,
    borderRadius: 'var(--radius-card)', fontFamily: 'var(--font-ui)',
    // 16px so iOS Safari doesn't auto-zoom the viewport on field focus, which
    // mid-checkout breaks the layout rhythm and feels janky.
    fontSize: '1rem', color: 'var(--ink-900)', background: 'var(--paper)',
  });
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: 6 };

  // Payment-failed banner (audit H1). Shown whenever a gateway callback
  // bounced back with ?error=…, in both the restored-bag form and the (rare)
  // couldn't-restore empty state. Copy varies: a clean gateway decline is the
  // shopper's to retry; a verification problem (signature/config/missing
  // order) may mean they DID pay, so it points at WhatsApp instead of
  // implying the money never moved.
  const bagRestored = cartItems.length > 0;
  const whatsappHref = `/go/whatsapp?src=payment_failed&text=${encodeURIComponent(
    `Hi! My online payment${failedOrder ? ` for order ${failedOrder}` : ''} didn't go through and I need help completing my order.`
  )}`;
  const paymentBanner = paymentError ? (
    <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '14px 16px', color: '#991b1b', fontSize: '0.875rem', lineHeight: 1.55, textAlign: 'left' }}>
      <strong style={{ display: 'block', marginBottom: 4, color: '#dc2626', fontSize: '0.9375rem' }}>
        {paymentError === 'payment_failed' ? 'Payment unsuccessful' : 'We couldn’t confirm your payment'}
      </strong>
      {paymentError === 'payment_failed' ? (
        <>
          Your payment{failedOrder ? <> for order <strong>{failedOrder}</strong></> : null} didn&rsquo;t go
          through, so the order hasn&rsquo;t been confirmed.{' '}
          {bagRestored
            ? 'Your bag is back below — try again, or switch to Cash on Delivery.'
            : 'Add your items again to retry, or choose Cash on Delivery at checkout.'}{' '}
          If money did leave your account, <a href={whatsappHref} style={{ color: 'inherit', fontWeight: 600 }}>message us on WhatsApp</a> and we&rsquo;ll sort it out.
        </>
      ) : (
        <>
          Something went wrong while verifying the payment response
          {failedOrder ? <> for order <strong>{failedOrder}</strong></> : null}. If you completed the
          payment, don&rsquo;t worry — <a href={whatsappHref} style={{ color: 'inherit', fontWeight: 600 }}>message us on WhatsApp</a> with
          your details and we&rsquo;ll confirm it manually. Otherwise you can simply try again
          {bagRestored ? ' below' : ''}.
        </>
      )}
    </div>
  ) : null;

  // Empty bag → no checkout form. Mirrors the cart page's empty state so the
  // two read as one voice; gated on `hydrated` so a saved cart never flashes
  // this while localStorage is still being read.
  if (hydrated && cartItems.length === 0) {
    return (
      <section style={{ padding: 'var(--section-gap) 0', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: 560 }}>
          {paymentBanner && <div style={{ marginBottom: 28 }}>{paymentBanner}</div>}
          {/* Lucide shopping-bag (same glyph as the header cart icon), never
              emoji or dingbats — keeps the empty state in the icon language
              the chrome already speaks. */}
          <div style={{ marginBottom: 16, color: 'var(--ink-300)' }} aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <h1 style={{ marginTop: 0, marginBottom: 12, fontFamily: 'var(--font-display)', fontSize: '2.25rem', fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            Your bag is empty
          </h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 28 }}>
            There&rsquo;s nothing to check out yet, add a few favourites and come straight back.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/shop" className="btn-primary">Start shopping</Link>
            {/* "View cart" on an empty bag was a dead end (the cart is just as
                empty) — point at the bestseller shelf instead. `?bestseller=1`
                is the filter CollectionPage actually reads. */}
            <Link href="/shop?bestseller=1" style={{
              padding: '12px 24px', background: 'transparent',
              border: '1px solid var(--line)', borderRadius: 'var(--radius-card)',
              fontFamily: 'var(--font-ui)', fontSize: '0.875rem', fontWeight: 600,
              color: 'var(--ink-900)', textDecoration: 'none',
            }}>
              Shop bestsellers
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div>
      <section style={{ padding: '48px 0 0', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          {paymentBanner && <div style={{ marginBottom: 24 }}>{paymentBanner}</div>}
          <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Checkout</Overline>
          <h1 className="display-l" style={{ fontSize: '2rem', marginBottom: 32 }}>Complete Your Order</h1>
        </div>
      </section>

      <section style={{ padding: '40px 0 var(--section-gap)' }}>
        <div className="container">
          {/* minmax(0, …): a bare fr track's minimum is its content's min-content
              size, so a long unbreakable value (email, promo code) could push the
              form column past the container and scroll the page sideways. */}
          {/* ≤860px only: a collapsed order summary above the form, so the
              items, live total and delivery line are visible without
              scrolling past the whole form. The full panel (with submit,
              coupon, loyalty, trust) still renders below, unchanged. */}
          <details className="checkout-mobile-summary" style={{ marginBottom: 20, border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', background: 'var(--paper2)' }}>
            <summary style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', listStyle: 'none', fontWeight: 600, fontSize: '0.875rem' }}>
              <span>Order summary · {cartItems.reduce((n, i) => n + i.qty, 0)} {cartItems.reduce((n, i) => n + i.qty, 0) === 1 ? 'item' : 'items'}</span>
              <span className="tabular-nums" style={{ fontWeight: 700 }}>PKR {total.toLocaleString()}</span>
            </summary>
            <div style={{ padding: '0 16px 14px' }}>
              {cartItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', fontSize: '0.8125rem' }}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.qty} × {item.name}</span>
                  <span className="tabular-nums" style={{ flexShrink: 0 }}>PKR {(item.price * item.qty).toLocaleString()}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--line)', fontSize: '0.8125rem' }}>
                <span>Delivery</span>
                <span className="tabular-nums">
                  {formData.province
                    ? (shipping === 0 ? 'FREE' : `PKR ${shipping.toLocaleString()}`)
                    : `from PKR ${defaultShippingRate.toLocaleString()}`}
                </span>
              </div>
              {seasonalCoupon && !cartCoupon && (
                <button
                  type="button"
                  onClick={() => applyCode(seasonalCoupon)}
                  disabled={couponLoading}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                    marginTop: 10, padding: '8px 10px',
                    background: '#f0fdf4', border: '1px dashed #86efac', borderRadius: 6,
                    fontSize: '0.8125rem', color: '#15803d', fontFamily: 'var(--font-ui)',
                  }}
                >
                  Sale code <strong>{seasonalCoupon}</strong> is running — tap to apply it
                </button>
              )}
            </div>
          </details>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 640px) 360px', gap: 48 }} className="checkout-grid">
            <form id="checkout-form" noValidate onSubmit={e => { e.preventDefault(); void handleSubmit(); }}>
              {/* COD-first field order: the four required facts (phone, name,
                  address, city) come first; optional email moved below the
                  address block so the form no longer OPENS with an optional
                  field, which read as "long form" to phone shoppers. */}
              <Overline style={{ display: 'block', marginBottom: 16 }}>Contact</Overline>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }} className="checkout-name-grid">
                <div>
                  <label htmlFor="co-phone" style={labelStyle}>Phone *</label>
                  <input ref={phoneRef} id="co-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required aria-required="true" value={formData.phone} onChange={e => update('phone', e.target.value)} placeholder="+92 300 1234567" style={inputStyle('phone')} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'co-phone-error' : undefined} />
                  {errors.phone && <span id="co-phone-error" style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{errors.phone}</span>}
                </div>
                <div>
                  <label htmlFor="co-name" style={labelStyle}>Full Name *</label>
                  <input id="co-name" name="name" autoComplete="name" required aria-required="true" value={formData.fullName} onChange={e => update('fullName', e.target.value)} placeholder="e.g. Ayesha Khan" style={inputStyle('fullName')} aria-invalid={!!errors.fullName} aria-describedby={errors.fullName ? 'co-name-error' : undefined} />
                  {errors.fullName && <span id="co-name-error" style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{errors.fullName}</span>}
                </div>
              </div>

              <hr className="hairline" style={{ margin: '32px 0' }} />
              <Overline style={{ display: 'block', marginBottom: 16 }}>Shipping Address</Overline>
              {/* Province first (required): one native tap resolves the
                  delivery zone, so the exact charge and ETA show below before
                  the shopper has typed a single address character. City
                  suggestions filter to the chosen province. */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }} className="checkout-name-grid">
                <div>
                  <label htmlFor="co-province" style={labelStyle}>Province *</label>
                  <select id="co-province" name="province" autoComplete="address-level1" required aria-required="true" value={formData.province} onChange={e => { provinceTouched.current = true; update('province', e.target.value); }} style={{ ...inputStyle('province'), cursor: 'pointer' }} aria-invalid={!!errors.province} aria-describedby={errors.province ? 'co-province-error' : undefined}>
                    <option value="">Select province</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  {errors.province && <span role="alert" id="co-province-error" style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{errors.province}</span>}
                </div>
                <div>
                  <label htmlFor="co-city" style={labelStyle}>City *</label>
                  <CityCombobox
                    id="co-city"
                    value={formData.city}
                    cities={cityOptions}
                    onChange={updateCity}
                    onBlurNormalize={v => updateCity(normalizeCity(v))}
                    inputStyle={inputStyle('city')}
                    invalid={!!errors.city}
                    describedBy={errors.city ? 'co-city-error' : undefined}
                  />
                  {errors.city && <span role="alert" id="co-city-error" style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{errors.city}</span>}
                </div>
              </div>
              {/* The zone answer, at the moment it's decided — not two screens
                  later in the totals. */}
              {formData.province && (
                <p className="small-text" aria-live="polite" style={{ margin: '0 0 16px', color: shipping === 0 ? 'var(--success, #15803d)' : 'var(--ink-700)', fontWeight: 600 }}>
                  {shippingLoading
                    ? 'Checking delivery for your area…'
                    : shipping === 0
                      ? `Delivery to ${formData.province}: FREE`
                      : `Delivery to ${formData.province}: PKR ${shipping.toLocaleString()}${shippingInfo.estimatedDays ? ` · arrives in ${shippingInfo.estimatedDays.min}–${shippingInfo.estimatedDays.max} days` : ''}`}
                </p>
              )}
              <div style={{ marginBottom: 16 }}>
                <label htmlFor="co-address" style={labelStyle}>Address *</label>
                <textarea id="co-address" name="address" rows={2} autoComplete="street-address" value={formData.address} onChange={e => update('address', e.target.value)} placeholder="House/flat, street, area" style={{ ...inputStyle('address'), resize: 'vertical', minHeight: 56 }} aria-invalid={!!errors.address} aria-describedby={errors.address ? 'co-address-error' : undefined} />
                {errors.address && <span role="alert" id="co-address-error" style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{errors.address}</span>}
              </div>
              {!moreAddress ? (
                <button
                  type="button"
                  aria-expanded={moreAddress}
                  aria-controls="co-more-address"
                  onClick={() => setMoreAddress(true)}
                  style={{
                    background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer',
                    fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', fontWeight: 600,
                    color: 'var(--brand-pink-text)', marginBottom: 12,
                  }}
                >
                  + Add postal code (optional)
                </button>
              ) : (
                <div id="co-more-address" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }} className="checkout-name-grid">
                  <div>
                    <label htmlFor="co-zip" style={labelStyle}>Postal Code</label>
                    <input id="co-zip" name="postal-code" autoComplete="postal-code" inputMode="numeric" value={formData.zip} onChange={e => update('zip', e.target.value)} style={inputStyle('zip')} />
                  </div>
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <label htmlFor="co-email" style={labelStyle}>Email {(payMethod === 'jazzcash' || payMethod === 'easypaisa' || payMethod === 'card') ? '*' : '(optional)'}</label>
                <input id="co-email" name="email" type="email" autoComplete="email" value={formData.email} onChange={e => update('email', e.target.value)} placeholder="For order updates and payment receipts" style={inputStyle('email')} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'co-email-error' : undefined} />
                {errors.email && <span id="co-email-error" style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{errors.email}</span>}
                {/* Capture nudge, copy only — the field stays optional. Orders
                    without an email get NO automated acknowledgment (WhatsApp
                    confirmation is manual), so every address captured here is
                    a customer who hears from us instantly, at any hour. */}
                {!formData.email && payMethod === 'cod' && (
                  <span className="small-text" style={{ display: 'block', marginTop: 4, color: 'var(--ink-500)' }}>
                    Add your email to get an instant order confirmation, even outside business hours.
                  </span>
                )}
              </div>

              <hr className="hairline" style={{ margin: '32px 0' }} />
              <Overline style={{ display: 'block', marginBottom: 16 }}>Payment Method</Overline>
              <style>{`.co-pay:focus-within { outline: 2px solid var(--brand-pink); outline-offset: 2px; border-radius: var(--radius-card); }`}</style>
              <div role="radiogroup" aria-label="Payment method">
                {visiblePayMethods.map(([key, label, desc]) => (
                  <label key={key} className="co-pay" style={{
                    position: 'relative',
                    display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px',
                    border: '1px solid ' + (payMethod === key ? 'var(--ink-900)' : 'var(--line)'),
                    borderRadius: 'var(--radius-card)', cursor: 'pointer',
                    marginBottom: -1, background: payMethod === key ? 'var(--paper2)' : 'transparent',
                    transition: 'all 150ms',
                  }}>
                    <input
                      type="radio" name="payMethod" value={key}
                      checked={payMethod === key}
                      onChange={() => setPayMethod(key)}
                      style={{ position: 'absolute', width: 1, height: 1, opacity: 0, margin: 0 }}
                    />
                    <div aria-hidden="true" style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1, border: payMethod === key ? '5px solid var(--ink-900)' : '2px solid var(--line)', transition: 'border 150ms' }} />
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{label}</div>
                      <div className="small-text">{desc}</div>
                    </div>
                  </label>
                ))}
              </div>
              {payMethod === 'bank' && bankAccounts.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <BankAccountsList accounts={bankAccounts} notes={bankNotes} />
                </div>
              )}
              {payMethod === 'jazzcash_qr' && jazzQrRows && jazzQrRows.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <JazzCashQrPanel rows={jazzQrRows} merchantTitle={jazzQrTitle} notes={jazzQrNotes} />
                </div>
              )}
            </form>

            <div ref={summaryRef} className="checkout-summary" style={{ background: 'var(--paper2)', borderRadius: 'var(--radius-card)', padding: 28, border: '1px solid var(--line)', alignSelf: 'start' }}>
              <Overline style={{ display: 'block', marginBottom: 16, color: 'var(--ink-500)' }}>Your Order</Overline>
              <div className="checkout-summary-items">
              {/* Editable right up to Place order: qty steppers and remove
                  per line, so second thoughts never force a trip back to the
                  cart (owner request, 5 Aug). Totals, shipping and coupon
                  maths all derive from cartItems, so they recompute live. */}
              {cartItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-card)', flexShrink: 0, overflow: 'hidden', background: 'var(--paper2)' }}>
                    <ProductImage src={item.image_url} alt={brandPlusName(item.brand, item.name)} width={48} height={48} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{item.name}</div>
                    {(item.variant_label ?? item.variant) && (
                      <div className="small-text" style={{ fontSize: '0.6875rem' }}>{item.variant_label ?? item.variant}</div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--line)', borderRadius: 8, background: '#fff' }}>
                        <button type="button" aria-label={`Reduce quantity of ${item.name}`} onClick={() => updateQty(i, -1)} disabled={item.qty <= 1}
                          style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: item.qty <= 1 ? 'default' : 'pointer', color: item.qty <= 1 ? 'var(--ink-300, #c9c2b6)' : 'var(--ink-700)', fontSize: '1rem', lineHeight: 1 }}>
                          &minus;
                        </button>
                        <span className="tabular-nums" style={{ minWidth: 20, textAlign: 'center', fontSize: '0.75rem', fontWeight: 600 }}>{item.qty}</span>
                        <button type="button" aria-label={`Increase quantity of ${item.name}`} onClick={() => updateQty(i, 1)}
                          style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-700)', fontSize: '1rem', lineHeight: 1 }}>
                          +
                        </button>
                      </div>
                      <button type="button" aria-label={`Remove ${item.name} from order`} onClick={() => { if (cartItems.length > 1 || window.confirm('Remove the last item? Your checkout will be emptied.')) removeFromCart(i); }}
                        className="small-text" style={{ background: 'none', border: 'none', color: 'var(--ink-500)', cursor: 'pointer', padding: 0, fontSize: '0.6875rem', textDecoration: 'underline' }}>
                        Remove
                      </button>
                    </div>
                  </div>
                  <span className="tabular-nums" style={{ fontSize: '0.8125rem', fontWeight: 500, flexShrink: 0 }}>PKR {(item.price * item.qty).toLocaleString()}</span>
                </div>
              ))}
              </div>
              <hr className="hairline" style={{ margin: '16px 0' }} />

              {!cartCoupon ? (
                <div style={{ marginBottom: 12 }}>
                  {seasonalCoupon && (
                    <button
                      type="button"
                      onClick={() => applyCode(seasonalCoupon)}
                      disabled={couponLoading}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                        marginBottom: 8, padding: '8px 10px',
                        background: '#f0fdf4', border: '1px dashed #86efac', borderRadius: 6,
                        fontSize: '0.8125rem', color: '#15803d', fontFamily: 'var(--font-ui)',
                      }}
                    >
                      Sale code <strong>{seasonalCoupon}</strong> is running — tap to apply it
                    </button>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      aria-label="Coupon code"
                      value={couponCode}
                      onChange={e => { setCouponCode(e.target.value); setCouponError(''); }}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void applyCoupon(); } }}
                      placeholder="Promo code (e.g. SAVE10)"
                      // minWidth 0: an input's intrinsic minimum (~20ch) stops flex
                      // shrinking it, pushing the Apply button off-screen on phones.
                      style={{ flex: 1, minWidth: 0, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 6, fontSize: '0.8125rem', background: 'white', fontFamily: 'var(--font-ui)', textTransform: 'uppercase' }}
                    />
                    <button onClick={applyCoupon} disabled={couponLoading} aria-busy={couponLoading} style={{
                      padding: '8px 14px', background: '#111827', color: 'white', border: 'none',
                      borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: couponLoading ? 'not-allowed' : 'pointer',
                    }}>
                      {couponLoading ? 'Checking…' : 'Apply'}
                    </button>
                  </div>
                  {couponError && <p role="alert" style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--error)' }}>{couponError}</p>}
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '8px 10px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                  <span style={{ fontSize: '0.8125rem', color: '#15803d', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <CheckIcon size={12} /> {cartCoupon.code} {freeShipCoupon ? '(free shipping)' : cartCoupon.type === 'percent' ? `(${cartCoupon.value}% off)` : `(PKR ${cartCoupon.value} off)`}
                  </span>
                  <button type="button" aria-label="Remove coupon" onClick={() => { setCouponCode(''); setAppliedCoupon(null); }} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1rem', width: 36, height: 36, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
                </div>
              )}

              {/* Loyalty points redemption (only when signed in with balance).
                  maxPoints is rate-aware: the most points that are either
                  available or needed to fully cover the payable amount. */}
              {loyalty && loyalty.points_balance > 0 && (() => {
                const maxPoints = loyaltyPkrPerPoint > 0
                  ? Math.min(loyalty.points_balance, Math.ceil(beforeRewards / loyaltyPkrPerPoint))
                  : loyalty.points_balance;
                return (
                <div style={{ marginBottom: 12, padding: '8px 10px', background: '#fffbeb', borderRadius: 6, border: '1px solid #fde68a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 600 }}>
                      ★ {loyalty.points_balance.toLocaleString()} points available
                      {loyaltyPkrPerPoint !== 1 && <> (1 point = PKR {loyaltyPkrPerPoint})</>}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        aria-label="Points to redeem"
                        type="text" inputMode="numeric" pattern="[0-9]*"
                        value={pointsRedeemInput}
                        onChange={e => {
                          const n = e.target.value === '' ? '' : Math.max(0, Math.min(maxPoints, Number(e.target.value)));
                          setPointsRedeemInput(n);
                          setPointsRedeem(typeof n === 'number' ? n : 0);
                        }}
                        placeholder="0"
                        style={{ width: 70, padding: '4px 6px', fontSize: '0.75rem', border: '1px solid #fde68a', borderRadius: 4, background: 'white', fontFamily: 'monospace' }}
                      />
                      <button aria-label="Use maximum available points" onClick={() => {
                        setPointsRedeemInput(maxPoints);
                        setPointsRedeem(maxPoints);
                      }} style={{ background: 'none', border: 'none', color: '#92400e', cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 600 }}>Use max</button>
                    </div>
                  </div>
                </div>
                );
              })()}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="small-text">Subtotal</span>
                <span className="small-text tabular-nums" style={{ fontWeight: 500 }}>PKR {subtotal.toLocaleString()}</span>
              </div>
              {discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="small-text" style={{ color: '#15803d' }}>
                    {referralDiscount > 0 && couponDiscount === 0
                      ? `Referral discount (${referralOffer?.pct}% off your first order)`
                      : !cartCoupon && autoDiscount
                        ? <>{autoDiscount.coupon.title || 'Discount'}<span style={{ display: 'block', fontSize: '0.6875rem', opacity: 0.75 }}>applied automatically</span></>
                        : 'Discount'}
                  </span>
                  <span className="small-text tabular-nums" style={{ fontWeight: 500, color: '#15803d' }}>− PKR {discount.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="small-text">Shipping{formData.province ? ` (${formData.province})` : shippingInfo.label ? ` (${shippingInfo.label})` : ''}</span>
                <span className="small-text tabular-nums" aria-live="polite" style={{ fontWeight: 500, color: shippingLoading ? 'var(--ink-500)' : shipping === 0 ? 'var(--success)' : 'inherit' }}>{shippingLoading ? 'updating…' : shipping === 0 ? 'FREE' : formData.province ? `PKR ${shipping}` : `from PKR ${shipping}`}</span>
              </div>
              {pointsDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="small-text" style={{ color: '#92400e' }}>Loyalty points</span>
                  <span className="small-text tabular-nums" style={{ fontWeight: 500, color: '#92400e' }}>− PKR {pointsDiscount.toLocaleString()}</span>
                </div>
              )}
              <hr className="hairline" style={{ margin: '16px 0' }} />
              {/* COD is pay-later: "Due now" on a cash order framed a
                  pay-nothing-today checkout as an immediate charge. */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                <span className="h3">{payMethod === 'cod' ? 'To pay on delivery' : 'Due now'}</span>
                <span className="h3 tabular-nums">PKR {total.toLocaleString()}</span>
              </div>
              {submitError && (
                <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#dc2626', fontSize: '0.8125rem' }}>
                  {submitError}
                </div>
              )}
              <button ref={submitBtnRef} type="submit" form="checkout-form" className="btn-primary" style={{ width: '100%', ...(submitting || cartItems.length === 0 ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }} disabled={submitting || cartItems.length === 0} aria-busy={submitting}>
                {submitting ? 'Placing Order…' : payMethod === 'jazzcash' || payMethod === 'easypaisa' ? `Continue to ${payMethod === 'jazzcash' ? 'JazzCash' : 'Easypaisa'} →` : 'Place Order'}
              </button>
              {payMethod === 'cod' && (
                <p className="small-text" style={{ textAlign: 'center', marginTop: 8, marginBottom: 0, color: 'var(--ink-700)' }}>
                  Pay nothing now. You pay the courier in cash when your order arrives.
                </p>
              )}
              <p className="small-text" style={{ textAlign: 'center', marginTop: 12, color: 'var(--ink-500)', display: 'inline-flex', width: '100%', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
                <span aria-hidden="true" style={{ display: 'inline-flex', lineHeight: 1 }}><LockIcon /></span> Secure checkout · COD available
              </p>
              {/* Reassurance strip at the decision point, checkout previously
                  carried no trust signals, a known driver of COD-market
                  abandonment. Plain text + ticks, no new assets. */}
              <ul style={{
                listStyle: 'none', padding: 0, margin: '14px 0 0',
                display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
                gap: '6px 16px',
              }}>
                {['100% authentic products', 'Pay cash on delivery', `${RETURNS_WINDOW_DAYS}-day easy returns`].map(t => (
                  <li key={t} className="small-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ink-700, var(--ink-500))' }}>
                    <span aria-hidden="true" style={{ color: 'var(--success, #15803d)', display: 'inline-flex' }}><CheckIcon /></span>
                    {t}
                  </li>
                ))}
              </ul>
              {/* Human escape hatch at the commit point. This link existed only
                  on the (unvisited) cart page and the payment-failed banner —
                  a stuck shopper mid-checkout had no way to ask a question
                  without abandoning. */}
              {hasWhatsApp() && (
                <p className="small-text" style={{ textAlign: 'center', marginTop: 12, marginBottom: 0 }}>
                  <a
                    href={whatsappGoUrl('Hi! I need a hand completing my order on the checkout page.', { src: 'checkout' })}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#0f766e', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3 }}
                  >
                    Stuck or have a question? WhatsApp us
                  </a>
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Sticky mobile commit bar (hidden ≥861px via .checkout-commit-bar in
          globals.css). Shows the live total and the same submit action while
          the summary panel is below the viewport, so the shopper always sees
          what they're committing to and a way to commit. */}
      <div
        className="checkout-commit-bar"
        inert={!showCommitBar}
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 90,
          background: 'color-mix(in srgb, var(--paper, #faf6ee) 97%, transparent)',
          backdropFilter: 'saturate(140%) blur(8px)',
          WebkitBackdropFilter: 'saturate(140%) blur(8px)',
          borderTop: '1px solid var(--line)',
          boxShadow: '0 -6px 18px rgba(0,0,0,0.06)',
          padding: '10px var(--side)',
          paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
          display: 'flex', alignItems: 'center', gap: 12,
          transform: showCommitBar ? 'translateY(0)' : 'translateY(110%)',
          transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
          pointerEvents: showCommitBar ? 'auto' : 'none',
        }}
      >
        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
          <div style={{ fontSize: '0.6875rem', color: 'var(--ink-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {payMethod === 'cod' ? `To pay on delivery · nothing now · ${RETURNS_WINDOW_DAYS}-day returns` : 'Due now'}
          </div>
          <div className="tabular-nums" style={{ fontSize: '1rem', fontWeight: 700 }}>
            PKR {total.toLocaleString()}
          </div>
          {submitError && (
            <div role="alert" style={{ fontSize: '0.6875rem', color: 'var(--error, #b4231f)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {submitError}
            </div>
          )}
        </div>
        <button
          className="btn-primary"
          type="submit"
          form="checkout-form"
          disabled={submitting || cartItems.length === 0}
          aria-busy={submitting}
          style={{
            flexShrink: 0, whiteSpace: 'nowrap', minHeight: 48, padding: '12px 20px',
            ...(submitting ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
          }}
        >
          {submitting ? 'Placing…' : payMethod === 'jazzcash' || payMethod === 'easypaisa' ? 'Continue →' : 'Place Order'}
        </button>
      </div>
    </div>
  );
}
