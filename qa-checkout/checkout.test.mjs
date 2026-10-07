/* Checkout security acceptance test — emulators ONLY (never live).
 * Start: firebase emulators:start --config firebase.b2c-e2e.json --project demo-luxardo-b2c
 * (functions/.env.local RAZORPAY_MOCK=1, functions/.secret.local test secrets) */
import crypto from 'crypto';
import path from 'path';
import { createRequire } from 'module';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, addDoc, collection, updateDoc } from 'firebase/firestore';
const require = createRequire(import.meta.url);
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const admin = require(require.resolve('firebase-admin', { paths: [path.resolve('../functions')] }));
admin.initializeApp({ projectId: 'demo-luxardo-b2c' });
const adb = admin.firestore();
const SECRET = 'local_test_secret_123', WH = 'local_webhook_secret';
let pass = 0, fail = 0, n = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', m); };
const rejects = async (p, re, m) => { try { await p; ok(false, m + ' (no error)'); } catch (e) { ok(re.test(e.message), m + ' -> ' + e.message); } };
async function customer() {
  const app = initializeApp({ apiKey: 'demo', projectId: 'demo-luxardo-b2c', authDomain: 'x' }, 'c' + (n++));
  const a = getAuth(app); connectAuthEmulator(a, 'http://127.0.0.1:9099', { disableWarnings: true });
  const u = (await signInAnonymously(a)).user;
  const f = getFunctions(app, 'us-central1'); connectFunctionsEmulator(f, '127.0.0.1', 5001);
  const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080);
  return { uid: u.uid, db, call: (name, d) => httpsCallable(f, name)(d).then(r => r.data) };
}
const sig = (o, p) => crypto.createHmac('sha256', SECRET).update(`${o}|${p}`).digest('hex');
const address = { fullName: 'Test Buyer', email: 'buyer@example.com', phone: '9876543210', addressLine1: '12 MG Road', addressLine2: '', city: 'Jaipur', state: 'Rajasthan', postalCode: '302001' };

await adb.doc('products/P1').set({ name: 'Navy Bandhgala Fabric', price: 15000, stock: 5, image: 'x.jpg', visibility: 'public' });
await adb.doc('products/P2').set({ name: 'Ivory Kurta Fabric', price: 4500, image: 'y.jpg' });
await adb.doc('products/HIDDEN').set({ name: 'Hidden', price: 100, visibility: 'hidden' });

const A = await customer(), B = await customer();
// 1. client cannot create orders (price tampering / fake paid)
await rejects(addDoc(collection(A.db, 'orders'), { userId: A.uid, totalAmount: 1, paymentStatus: 'paid', items: [] }), /permission/i, 'client cannot write a fake paid order');
// 2. server prices the cart — any client-sent price/amount ignored
const r = await A.call('createRazorpayOrder', { items: [{ productId: 'P1', size: 'M', quantity: 2, price: 1 }, { productId: 'P2', quantity: 1 }], address, amount: 100 });
ok(r.amount === (15000 * 2 + 4500) * 100, `server amount = 34500 INR in paise (${r.amount})`);
let o = (await adb.doc(`orders/${r.orderId}`).get()).data();
ok(o.paymentStatus === 'pending' && o.awaitingPayment === true && o.totalAmount === 34500, 'order created server-side, unpaid');
ok(o.items[0].price === 15000 && o.items[0].title === 'Navy Bandhgala Fabric', 'line price from Firestore');
await rejects(updateDoc(doc(A.db, 'orders', r.orderId), { paymentStatus: 'paid' }), /permission/i, 'client cannot mark own order paid');
// 3. bad signature
const bad = await A.call('verifyRazorpayPayment', { orderId: r.orderId, razorpay_order_id: r.razorpayOrderId, razorpay_payment_id: 'pay_1', razorpay_signature: 'ab'.repeat(32) });
ok(bad.verified === false, 'forged signature rejected');
ok((await adb.doc(`orders/${r.orderId}`).get()).data().paymentStatus === 'pending', 'order still unpaid after forged signature');
// 4. other user cannot confirm A's order
await rejects(B.call('verifyRazorpayPayment', { orderId: r.orderId, razorpay_order_id: r.razorpayOrderId, razorpay_payment_id: 'pay_1', razorpay_signature: sig(r.razorpayOrderId, 'pay_1') }), /not found for this user/, "another customer cannot confirm someone else's order");
// 5. signature for a different razorpay order cannot pay this order
const r2 = await A.call('createRazorpayOrder', { items: [{ productId: 'P2', quantity: 1 }], address });
await rejects(A.call('verifyRazorpayPayment', { orderId: r.orderId, razorpay_order_id: r2.razorpayOrderId, razorpay_payment_id: 'pay_x', razorpay_signature: sig(r2.razorpayOrderId, 'pay_x') }), /does not belong/, 'cheap order payment cannot confirm an expensive order');
// 6. valid payment
const good = await A.call('verifyRazorpayPayment', { orderId: r.orderId, razorpay_order_id: r.razorpayOrderId, razorpay_payment_id: 'pay_1', razorpay_signature: sig(r.razorpayOrderId, 'pay_1') });
o = (await adb.doc(`orders/${r.orderId}`).get()).data();
ok(good.verified && o.paymentStatus === 'paid' && o.status === 'processing' && o.razorpay.paymentId === 'pay_1', 'valid payment marks order paid/processing');
ok((await adb.doc('products/P1').get()).data().stock === 3, 'stock 5 -> 3 after paid order');
ok((await getDoc(doc(A.db, 'orders', r.orderId))).data().totalAmount === 34500, 'customer can read own order');
await A.call('verifyRazorpayPayment', { orderId: r.orderId, razorpay_order_id: r.razorpayOrderId, razorpay_payment_id: 'pay_1', razorpay_signature: sig(r.razorpayOrderId, 'pay_1') });
ok((await adb.doc('products/P1').get()).data().stock === 3, 'repeat verify does not decrement stock twice');
// 7. webhook confirms when browser closed
const r3 = await B.call('createRazorpayOrder', { items: [{ productId: 'P1', quantity: 1 }], address });
const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_wh', order_id: r3.razorpayOrderId } } } });
const whBad = await fetch('http://127.0.0.1:5001/demo-luxardo-b2c/us-central1/razorpayWebhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-razorpay-signature': 'nope' }, body });
ok(whBad.status === 400, 'webhook with bad signature rejected');
const wh = await fetch('http://127.0.0.1:5001/demo-luxardo-b2c/us-central1/razorpayWebhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-razorpay-signature': crypto.createHmac('sha256', WH).update(body).digest('hex') }, body });
o = (await adb.doc(`orders/${r3.orderId}`).get()).data();
ok(wh.status === 200 && o.paymentStatus === 'paid' && o.razorpay.verifiedBy === 'webhook', 'webhook marks order paid without browser');
// 8. stock and availability
await rejects(A.call('createRazorpayOrder', { items: [{ productId: 'P1', quantity: 9 }], address }), /Only 2 left/, 'cannot order more than stock');
await rejects(A.call('createRazorpayOrder', { items: [{ productId: 'HIDDEN', quantity: 1 }], address }), /no longer available/, 'hidden product cannot be ordered');
await rejects(A.call('createRazorpayOrder', { items: [{ productId: 'P2', quantity: 1 }], address: { ...address, postalCode: '12' } }), /pincode/, 'invalid pincode rejected');
// 9. COD
await rejects(A.call('createCodOrder', { items: [{ productId: 'P2', quantity: 1 }], address: { ...address, postalCode: '110001' } }), /not available for this pincode/, 'COD blocked outside COD pincodes');
const cod = await A.call('createCodOrder', { items: [{ productId: 'P2', quantity: 2, price: 1 }], address });
o = (await adb.doc(`orders/${cod.orderId}`).get()).data();
ok(cod.totalAmount === 9000 && o.paymentMethod === 'COD' && o.status === 'pending', 'COD order server-priced (9000)');
// 10. admin (customers/{uid}.role = admin) can still manage orders
const ADM = await customer();
await adb.doc(`customers/${ADM.uid}`).set({ role: 'admin', email: 'admin@example.com' });
await updateDoc(doc(ADM.db, 'orders', cod.orderId), { status: 'processing', paymentStatus: 'confirmed' }).then(() => ok(true, 'admin can update order status'), e => ok(false, 'admin can update order status -> ' + e.message));
console.log(`\nRESULT pass=${pass} fail=${fail}`); process.exit(fail ? 1 : 0);
