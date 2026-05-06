# Firebase Migration Deployment Guide

## 🚀 Deploy करने से पहले:

### 1. Firebase Rules Deploy करें
```bash
# Firestore security rules को update करें
firebase deploy --only firestore:rules

# Verify rules deployed
firebase firestore:indexes
```

### 2. Backend Code Deploy करें
```bash
# Build और verify करें
npm run build

# Test locally
npm run dev

# Deploy to production
firebase deploy --only hosting
# या
vercel deploy (if using Vercel)
```

### 3. Verify Deployment
```bash
✅ Firestore rules deployed and activated
✅ Collections created automatically (orders, users, carts, etc.)
✅ No TypeScript errors in build
✅ All Firebase imports working
```

---

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Run `npm run build` - confirms no errors ✅
- [ ] Check Firestore is enabled in Firebase Console
- [ ] Verify Authentication is enabled (Email/Password or Google)
- [ ] Check firestore.rules file exists ✅

### During Deployment
```bash
# Deploy rules first (most critical)
firebase deploy --only firestore:rules

# Deploy code second
firebase deploy --only hosting

# Or with Vercel
vercel deploy --prod
```

### Post-Deployment Verification
- [ ] Visit https://yoursite.com/checkout → Should NOT redirect to /backend
- [ ] Login with test account → Add to cart → Confirm in Firestore
- [ ] Place order → Check /orders collection in Firestore
- [ ] Logout → Cart should be cleared in Firestore
- [ ] Check browser console for errors

---

## 🔍 Firestore Console Checks

After deployment, verify in Firebase Console:

### Collections Created
```
✅ /users/{userId} - Should have test user profiles
✅ /carts/{userId} - Should have cart data
✅ /orders/{orderId} - Should have placed orders
✅ /userPreferences/{userId} - Should have language/country settings
✅ /wishlists/{userId} - Should have saved items
```

### Security Rules Deployed
```firestore
✅ Products can be read publicly
✅ Orders require userId
✅ Users can only access own data
```

---

## 🐛 Troubleshooting

### "Permission denied" on checkout
```
❌ Problem: Firestore rules not deployed
✅ Solution: 
   firebase deploy --only firestore:rules
```

### Orders not saving
```
❌ Problem: userId not included in order
✅ Solution: 
   Verify CheckoutPage.tsx line includes userId: currentUser.uid
   Check auth.currentUser is not null
```

### Cart not persisting after login
```
❌ Problem: Not switching from sessionStorage to Firestore
✅ Solution:
   Check firebaseStorage.saveCart() is being called
   Check Firestore carts/{uid} collection exists
```

### Data visible in old localStorage, not in Firestore
```
❌ Problem: Users still have old cached data
✅ Solution:
   First login will trigger migration
   Browser DevTools → Application → Clear Site Data
   Or tell users to clear browser cache
```

---

## 📊 Monitoring After Deployment

### Key Metrics to Check
- [ ] /orders collection growing (new orders being created)
- [ ] /carts collection entries (users saving carts)
- [ ] Authentication sign-ups increasing
- [ ] Firestore read/write operations normal

### Firebase Console → Firestore → Monitor
```
Reads:  Check normal (not spiking)
Writes: Check normal (not spiking)
Deletes: Check normal during logout
```

---

## 🔐 Security Best Practices

### Keep Firestore Rules Updated
```firestore
❌ Don't use "allow read, write: if true"
✅ Use specific user auth checks
✅ Enforce userId in orders
✅ Limit admin write access
```

### Monitor Firebase Quota
- [ ] Firestore storage limits
- [ ] Real-time listener count
- [ ] Read/write operation costs

---

## 📱 Testing After Deployment

### Test Scenarios
```
1. Anonymous user
   → Browse products ✓
   → Add to cart (sessionStorage) ✓
   → Login (cart migrates to Firestore) ✓

2. Logged-in user
   → Login ✓
   → Add to cart (saved in Firestore) ✓
   → Change language (saved in userPreferences) ✓
   → Logout (data cleared) ✓
   → Re-login (data restored from Firestore) ✓

3. Order flow
   → Checkout page loads (not redirecting to admin) ✓
   → Fill form → Place order (saves to /orders) ✓
   → Order confirmation appears ✓
   → Verify in Firestore /orders collection ✓

4. Admin flow
   → Admin login → /admin/dashboard (separate auth) ✓
   → View orders (can see all /orders) ✓
   → No conflicts with customer checkout ✓
```

---

## 🎯 Rollback Plan

If issues arise:

### Immediate Rollback
```bash
# Revert Firestore rules if they're the issue
firebase deploy --only firestore:rules (from previous version)

# Revert deployed code if needed
git revert HEAD
npm run build
firebase deploy --only hosting
```

### Data Safety
```
❌ Don't delete Firestore collections
✅ Keep orders and user data intact
✅ New deployments won't affect old data
✅ localStorage fallback still works for local caching
```

---

## ✅ Sign-off Checklist

Before considering migration complete:

- [ ] Build succeeds (npm run build) ✅
- [ ] Firestore rules deployed ✅
- [ ] No TypeScript errors ✅
- [ ] Orders can be created and viewed ✅
- [ ] Cart works for logged-in users ✅
- [ ] Admin panel separate from checkout ✅
- [ ] Users can login and logout ✅
- [ ] Preferences persist across sessions ✅
- [ ] Anonymous users not redirected ✅
- [ ] No console errors in production ✅

---

## 📞 Emergency Contact

If deployment fails:
1. Check Firebase Console for errors
2. Run: `firebase logs:read` 
3. Verify firestore.rules syntax
4. Check browser console (DevTools → Console)
5. Verify Firebase credentials in src/firebase.ts

Good luck! 🚀
