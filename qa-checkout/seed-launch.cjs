process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'; process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';
const admin=require(require('path').join(__dirname,'..','functions','node_modules','firebase-admin'));
admin.initializeApp({projectId:'demo-luxardo-b2c'}); const db=admin.firestore();
(async()=>{
  const cats=[
    {id:'col_tux',name:'Tuxedo',slug:'tuxedos',sortOrder:1,isVisible:true,shortDescription:'CURATED COLLECTION'},
    {id:'col_3ps',name:'3 Piece Suit',slug:'lxf3piecesuit',sortOrder:2,isVisible:true},
    {id:'col_cas',name:'CASUAL',slug:'casual',sortOrder:3,isVisible:true},
    {id:'col_hid',name:'Secret',slug:'secret',sortOrder:4,isVisible:false},
  ];
  for(const c of cats) await db.doc('categories/'+c.id).set(c);
  const now=Date.now();
  const P=[
    {id:'LXF-TUX-001',name:'Midnight Tuxedo',price:14999,category:'Tuxedo'},
    {id:'LXF-CAS-001',name:'Silent Bloom Shirt',price:399,category:'CASUAL'},
    {id:'LXF-3PS-001',name:'Royal 3 Piece',price:8999,category:'3 piece suit'},
    {id:'LXF-HID-001',name:'Draft Hidden Product',price:500,category:'CASUAL',visibility:'hidden'},
  ];
  let i=0; for(const p of P){ i++; await db.doc('products/'+p.id).set({visibility:'public',image:'',images:[],description:'Premium fabric.',stock:10,chestSizes:'38, 40, 42',standardSizes:'38, 40, 42',createdAt:new Date(now-i*1000).toISOString(),updatedAt:new Date().toISOString(),...p}); }
  console.log('seeded');
})().catch(e=>{console.error(e);process.exit(1)});
