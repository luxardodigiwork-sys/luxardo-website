process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'; process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';
const admin=require(require('path').join(__dirname,'..','functions','node_modules','firebase-admin'));
admin.initializeApp({projectId:'demo-luxardo-b2c'});
(async()=>{
 const now=Date.now(); const cats=['3 Piece Suit','Jodhpuri','Kurta','Koti Kurta','Tuxedo'];
 for(let i=1;i<=6;i++){ const id=`lx-test-${i}`; await admin.firestore().doc(`products/${id}`).set({id,name:`Test Fabric ${i}`,slug:id,price:2500*i,category:cats[i%cats.length],image:'',images:[],description:'Premium ready-to-stitch fabric set for testing.',stock:10,visibility:'public',readyToStitch:true,featured:i<4,createdAt:new Date(now-i*1000).toISOString(),updatedAt:new Date().toISOString()}); }
 let u; try{u=await admin.auth().getUserByEmail('admin@test.lux')}catch{u=await admin.auth().createUser({email:'admin@test.lux',password:'Test@12345'})}
 await admin.firestore().doc(`customers/${u.uid}`).set({uid:u.uid,email:'admin@test.lux',role:'admin',firstName:'Admin',lastName:'Test'});
 console.log('seeded');
})();
