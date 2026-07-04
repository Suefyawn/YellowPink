// Which hosted-gateway credentials are actually present in the environment.
// Checkout and the admin Payments tab both read these so a payment method is
// never offered to a customer when its gateway route would 500 on missing env
// vars (an enabled-but-unconfigured method stranded orders in payment_pending).
// Card checkout is processed via JazzCash, so it shares that gateway's check.

export function jazzcashConfigured(): boolean {
  return Boolean(
    process.env.JAZZCASH_MERCHANT_ID
    && process.env.JAZZCASH_PASSWORD
    && process.env.JAZZCASH_INTEGRITY_SALT,
  );
}

export function easypaisaConfigured(): boolean {
  return Boolean(process.env.EASYPAISA_STORE_ID && process.env.EASYPAISA_HASH_KEY);
}
