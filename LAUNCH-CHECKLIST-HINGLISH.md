# Luxardo Fashion - Live karne ki checklist (simple Hinglish)

Ek time par ek hi step karo. Har step ke baad "Done" tick karo. Koi password, key ya secret chat me paste mat karna.
Pehle STAGING (test project), phir PRODUCTION (asli site). Staging pass hone se pehle production ko haath mat lagao.

---

## Step 0 - Safety pehle (production par, sirf dekhna)
- [ ] Firebase Console kholo -> apna asli project -> **Build -> Functions**.
- [ ] Screenshot lo: list me kaun-kaun se function hain, region (us-central1 / asia-south1) ke saath. **Delete mat karna.**
- [ ] `createRazorpayOrder` par click karo -> **Metrics** -> "Last 30 days" -> screenshot lo (invocations aur errors).
- [ ] **Firestore Database -> Rules** -> screenshot (published date ke saath).
- [ ] **Firestore Database -> Backups / Export**: backup/export option check karo. Production me data hai to pehle backup lo.
- [ ] Ye screenshots mujhe bhejo. Main batata hun purane functions band karne hain ya nahi.

## Step 1 - Staging project banao
- [ ] Firebase Console -> **Add project** -> naam: `luxardo-staging` (kuch bhi, par "staging" likho).
- [ ] **Project settings -> General**: **Project ID** copy karke kahin note karo.
- [ ] Wahin **Your apps -> Web app (</>)** add karo, config (apiKey, appId, etc.) note karo. Ye secret nahi hai, par chat me tabhi bhejo jab main maangun.
- [ ] **Upgrade to Blaze plan** (Functions aur Phone SMS ke liye zaroori). **Budget alert** lagao (jaise Rs 500/1000).
- [ ] **Build -> Authentication -> Sign-in method**: **Google** aur **Phone** dono Enable karo.
- [ ] **Authentication -> Settings -> Authorized domains**: staging/preview wala domain add karo.
- [ ] **Build -> Firestore Database** banao (region sochkar chuno, baad me badal nahi sakte; India ke liye `asia-south1` theek hai).
- [ ] **Build -> Storage** banao.

## Step 2 - Razorpay TEST mode
- [ ] Razorpay Dashboard -> upar **Test Mode** ON rakho.
- [ ] **Settings -> API Keys -> Generate Test Key**. Key ID aur Key Secret apne paas safe rakho. **Chat me paste mat karna.**
- [ ] Webhook baad me (Step 4 ke baad) banega, kyunki URL deploy ke baad milta hai.

## Step 3 - Apne PC par code deploy (staging only)
Ye commands aapke PC ke terminal me chalenge (is cloud session me Firebase login nahi hai). Mujhse exact commands chahiye ho to bolo.
- [ ] `.firebaserc` me `REPLACE_WITH_STAGING_PROJECT_ID` ki jagah staging Project ID daalo.
- [ ] Function settings (CLI se): `RAZORPAY_KEY_ID`, `ADMIN_UIDS` (aapka UID), optional `OWNER_NOTIFY_EMAIL`; secrets: `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
- [ ] Deploy hamesha project likhkar: `firebase deploy --only functions,firestore:rules,storage --project staging`. **Bina `--project` ke kabhi nahi.**
- [ ] Deploy ke baad **Functions** me dekho: `createCheckoutOrderFn`, `verifyPaymentFn`, `razorpayWebhook` sab **asia-south1** me hon.

## Step 4 - Razorpay webhook (test)
- [ ] Functions me `razorpayWebhook` ka URL copy karo.
- [ ] Razorpay Dashboard (Test) -> **Settings -> Webhooks -> Add**: wahi URL, events: `payment.captured`, `payment.failed`, `order.paid`.
- [ ] Webhook secret wahi rakho jo `RAZORPAY_WEBHOOK_SECRET` me set kiya.

## Step 5 - Admin aur email
- [ ] Staging site par ek baar sign in karo -> Console -> **Authentication -> Users** se apna **UID** copy karo.
- [ ] Wahi UID `ADMIN_UIDS` me daalo. `firestore.rules` aur `storage.rules` me jo 2 purane UID hardcoded hain, unhe apne UID se badalna hai (production se pehle).
- [ ] **Extensions -> Trigger Email from Firestore** install karo (collection: `mail`), SMTP/SendGrid ke saath. Jab tak ye nahi, email deliver nahi hogi.

## Step 6 - Staging par poora test (sabse zaroori)
Test phone number Firebase me add kar sakte ho (Authentication -> Sign-in method -> Phone -> test numbers).
- [ ] Ek test product daalo (Admin -> Add Product): naam, category, price, stock, photo, **Ready-to-Stitch** wording.
- [ ] Google se sign in -> phone OTP verify.
- [ ] Product cart me -> Checkout -> Razorpay **test card** se payment -> Order Confirmation page.
- [ ] Admin me order dikhe, status "paid".
- [ ] Stock 1 kam hua? (sirf ek baar)
- [ ] **`/account` par page refresh karo** -> login par wapas nahi bhejna chahiye.
- [ ] Payment beech me cancel karo -> order unpaid rahe, stock wapas aa jaye (payment window ke baad).
- [ ] Email aayi? (agar extension installed hai)
- [ ] Koi bhi error ya kuch ajeeb dikha to **screenshot** lo, mujhe bhejo.

## Step 7 - Asli content
- [ ] Har product: naam, category, price (INR), stock, fabric/composition, colour, sizes, description, 1+ asli photo.
- [ ] Har page par clearly likha ho: **"Ready-to-Stitch Fabric - stitching included nahi hai."**
- [ ] Policy pages: Returns, Shipping, Privacy, Terms. GST wording aur support email sahi daalo.
- [ ] Fresh decision: returned / failed_delivery / on_hold orders cancel ho sakte hain ya nahi.

## Step 8 - Purani cheezein saaf karo
- [ ] `luxardo.db` me 5 staff ke passwords ke hash git history me hain -> un logon ke passwords **badlo**. File delete karne se history nahi mitegi.
- [ ] Purane `createRazorpayOrder` / `verifyRazorpayPayment` / purana `razorpayWebhook` (us-central1): Step 0 ke screenshots dekhkar mere saath decide karo. **Khud delete mat karna.**

## Step 9 - PRODUCTION (sirf Step 1-8 pass hone ke baad)
- [ ] Pehle Firestore ka **backup/export** lo.
- [ ] Production project ke liye Step 1, 2, 3, 4, 5 dobara karo, **LIVE** Razorpay keys ke saath, aur live webhook.
- [ ] `.firebaserc` me production ID daalo, `firebase deploy ... --project production`.
- [ ] GitHub -> Actions -> "Run workflow" -> target `production` -> typed confirmation `DEPLOY PRODUCTION` (Hosting).
- [ ] Pehle **Rs 1-10 ka ek chhota asli order khud karo**, phir Razorpay Dashboard se refund karo.
- [ ] 24 ghante tak Functions logs aur Razorpay Dashboard dekhte raho.

---

### Kya sirf main nahi kar sakta
Firebase/Razorpay/GitHub ke settings, passwords rotate karna, asli products aur photos, aur Console/Razorpay screenshots. Baaki code ki verification main karunga.

### Ruk jao agar...
- Purane `createRazorpayOrder` par invocations dikhein (koi use kar raha hai).
- Staging test me stock do baar kam ho ya payment ke baad order "paid" na ho.
- Kisi step me secret/key chat me paste karne ko kaha jaye. Ye galat hai, mana kar do.
