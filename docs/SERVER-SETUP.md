# Getting a server, for someone who has never done it

Last updated: 15 September 2026

`SELF-HOSTING.md` explains how the store runs off Vercel. It opens with
"provision the box", which assumes you already know how to get one. This
document is that missing step, written to be followed without knowing what
any of it means.

Budget about **an hour**, most of it waiting for a build. You cannot break the
live store doing this: Vercel keeps serving yellowpink.pk the entire time, and
nothing here touches Supabase, so the catalogue, orders and customers are never
at risk. The last step, moving DNS, is the only one that changes what customers
see, and it comes after you have tested everything.

---

## 1. Pick where the server lives

You need a **VPS**: a computer in a data centre that you rent and control. Two
worth considering, and the honest trade between them is money against fiddliness.

### Option A — Hetzner, about €4/month (~PKR 1,250)

The one to pick unless you specifically want to pay nothing. Signup is
ordinary, the server appears in about a minute, and it has never been known to
refuse to give you one.

- Go to **hetzner.com/cloud**, make an account, verify the email.
- **New project** → **Add server**.
- Location: **Singapore** (closest to Pakistan of the ones they have).
- Image: **Ubuntu 24.04**.
- Type: **CX22** — 2 vCPU, 4 GB RAM. This is the smallest that builds the site
  comfortably.
- SSH key: see step 2 below, do that first and paste the key here.
- Create. Note the IP address it gives you.

Against Vercel Pro at $20/month, this is roughly a **75% saving**.

### Option B — Oracle Cloud Always Free, PKR 0/month

Genuinely free forever, not a trial, and the free machine is far larger than
this store needs (up to 4 ARM cores and 24 GB of RAM). Two real catches:

- Signup asks for a credit card for identity verification. It is not charged,
  but it must be a working card.
- The free ARM machines are heavily oversubscribed. "Out of host capacity" is
  common and you may have to retry over a few days, or try the Hyderabad region
  instead of Mumbai.

If you have the patience it is the better answer, because PKR 0 beats PKR 1,250
and the hardware is better. If a half-finished migration would annoy you, pay
Hetzner the €4.

- **cloud.oracle.com** → Sign up → home region **India South (Hyderabad)** or
  **India West (Mumbai)**. This cannot be changed later, so pick carefully.
- **Compute → Instances → Create instance**.
- Image **Canonical Ubuntu 24.04**, shape **VM.Standard.A1.Flex**, set it to
  **2 OCPUs and 12 GB** (still inside the free allowance).
- Upload your SSH public key from step 2.
- After it starts: **Networking → Virtual Cloud Network → Security List** and
  allow inbound TCP on **80** and **443**. Oracle blocks these by default and
  forgetting it looks exactly like a broken server.

### What not to bother with

- **Shared hosting** (wp-arena and similar). It runs PHP and WordPress. This
  store is a Node application and will not run there at any price.
- **Render's free tier.** It sleeps after 15 minutes of inactivity and takes
  about a minute to wake. On a store getting 15 visitors a day, nearly every
  visitor would meet the cold start. It also has no cron on the free plan.
- **Anything with 1 GB of RAM.** The build runs out of memory. The script adds
  swap so it survives, but it will be slow and unpleasant.

---

## 2. Get yourself an SSH key

SSH is how you log in to the server. A key is a pair of files: a public half you
give the provider, and a private half you keep.

**On Windows** open PowerShell; **on Mac** open Terminal. Then:

```bash
ssh-keygen -t ed25519
```

Press Enter three times to accept the defaults. Then print the public half:

```bash
# Mac / Linux
cat ~/.ssh/id_ed25519.pub

# Windows PowerShell
type $env:USERPROFILE\.ssh\id_ed25519.pub
```

It is one line starting `ssh-ed25519`. Copy the whole line and paste it into the
"SSH key" box when creating the server.

Never share the other file, the one without `.pub`. That one is the key itself.

---

## 3. Log in

```bash
ssh root@YOUR_SERVER_IP
```

It will ask once whether you trust the host. Type `yes`. You should land on a
line ending in `#`. That is the server.

---

## 4. Run the setup script

On the server:

```bash
curl -fsSL https://raw.githubusercontent.com/Suefyawn/YellowPink/main/scripts/provision.sh -o provision.sh
less provision.sh
bash provision.sh yellowpink.pk
```

The `less` is not decoration. You are about to run a script as root; read it
first, and press `q` to exit the viewer. Never run a script from the internet as
root without looking at it, including this one.

The script installs Node, installs Caddy (which gets the HTTPS certificate on
its own, so there is no certificate to renew or forget), fetches the code, sets
up the service and the three scheduled jobs, and starts everything.

**It will stop partway through, on purpose.** It writes a blank file at
`/etc/yellowpink.env` and asks you to fill it in, because those are secrets it
has no way to know.

### Filling in the environment file

Open the Vercel dashboard in your browser: **your project → Settings →
Environment Variables**. Every value you need is there.

On the server:

```bash
nano /etc/yellowpink.env
```

Paste each value after its `=` sign. Save with **Ctrl+O**, Enter, then exit with
**Ctrl+X**.

Three of them decide whether the store is real:

| Variable | What happens without it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Demo mode: fake products, no orders |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Demo mode |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin, orders and email all fail |

The script refuses to continue without those three, because a store that boots
happily and serves fake products is a worse outcome than one that will not
start.

Then run it again. It picks up where it stopped:

```bash
bash provision.sh yellowpink.pk
```

The build takes five to fifteen minutes depending on the machine. When it
finishes it prints "Done".

---

## 5. Test before you switch

Do not move DNS yet. Check the new server by pretending, on your own computer
only, that the domain already points at it.

Find your computer's hosts file:

- **Mac/Linux**: `/etc/hosts`
- **Windows**: `C:\Windows\System32\drivers\etc\hosts` (open Notepad as
  Administrator)

Add one line, with your server's IP:

```
203.0.113.10  yellowpink.pk www.yellowpink.pk
```

Now your browser reaches the new server while everyone else still gets Vercel.
Walk the store as a customer would:

- [ ] Home page, and the images actually load
- [ ] `/shop`, and a product page
- [ ] A collection page, and `/page/faq`
- [ ] `/robots.txt` and `/sitemap.xml` return text, not an error
- [ ] Add to cart, go to checkout, **place a real test order**
- [ ] The order email arrives, and its "Confirm my order" button works
- [ ] Log in to `/admin` and find that test order
- [ ] Prices, stock and collections match the live site

If anything is wrong, nothing is lost: delete the hosts line and you are back to
normal. The live store never saw any of this.

Then run each scheduled job once by hand and confirm it exits cleanly:

```bash
sudo -u yellowpink /srv/yellowpink/scripts/run-cron.sh daily
sudo -u yellowpink /srv/yellowpink/scripts/run-cron.sh indexing-check
sudo -u yellowpink /srv/yellowpink/scripts/run-cron.sh weekly
```

Remove the hosts line when you are done testing.

---

## 6. Move the domain

Only when every box above is ticked.

At your DNS provider, point the domain at the server:

| Type | Name | Value |
|---|---|---|
| A | `@` | your server IP |
| A | `www` | your server IP |

Set TTL as low as it allows (300 seconds) a day beforehand if you can, so a
mistake can be undone quickly.

Propagation takes minutes to a few hours. **Leave Vercel running throughout.**
The same commit serves both — `output: 'standalone'` is inert on Vercel — so
whichever one a visitor reaches, they get a working store.

---

## 7. Cancel Vercel

Wait for the new server to have served **a full day, including one successful
daily cron run**. Check:

```bash
tail -50 /var/log/yellowpink-cron.log
journalctl -u yellowpink --since "24 hours ago" | grep -i error
```

The cron log is the one that matters. The site being up is obvious; a silently
failing cron is not, and it is how the abandoned-cart and review-request emails
would quietly stop going out for weeks before anyone noticed.

Then cancel the plan at **vercel.com → Settings → Billing**.

---

## Running it from here

**Deploy a change** that has been merged to main:

```bash
ssh root@YOUR_SERVER_IP
bash /srv/yellowpink/scripts/deploy.sh
```

It builds first and only swaps the running server if the build succeeded, so a
bad commit leaves the site on the previous version rather than taking it down.

**Watch the logs**, live:

```bash
journalctl -u yellowpink -f
```

**Restart**, if it ever needs it:

```bash
systemctl restart yellowpink
```

**Keep the machine patched.** Once a month:

```bash
apt update && apt upgrade -y && reboot
```

---

## When something is wrong

| What you see | What to do |
|---|---|
| The site does not load at all | `systemctl status yellowpink`, then `journalctl -u yellowpink -n 50` |
| Loads, but no styling or images | The build did not copy `public/`. Re-run `deploy.sh`. |
| Fake products, prices wrong | Supabase variables missing from `/etc/yellowpink.env`. Fix, then `deploy.sh`. |
| Browser warns about the certificate | Caddy needs ports 80 and 443 reachable. On Oracle, check the Security List. |
| Build is killed with no message | Out of memory. The script adds swap; if you skipped it, `free -h` will show none. |
| Emails stopped | `tail -50 /var/log/yellowpink-cron.log` — the daily job is what sends them. |

If you are stuck, the answer is almost always in `journalctl -u yellowpink -n 100`.
Copy that output when asking for help; it says what actually happened.
