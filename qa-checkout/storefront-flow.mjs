/* Phone-size browser purchase flow (emulators only). Needs: storefront built with
 * .env.local pointing at demo-luxardo-b2c + VITE_USE_EMULATOR=true, served by
 * vite preview on :4180, and playwright installed. */
import { chromium } from 'playwright';
const BASE='http://localhost:4180';
const b=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const p=await ctx.newPage(); const errs=[]; let v2=false;
p.on('pageerror',e=>errs.push('pageerror '+e.message.slice(0,160)));
p.on('request',r=>{ if(r.url().includes('createRazorpayOrderV2')) v2=true; });
const txt=async()=>(await p.locator('body').innerText()).replace(/\s+/g,' ');
const fill=async()=>{ for (const [n,v] of [['fullName','Ravi Sharma'],['email','ravi@example.com'],['phone','9876543210'],['addressLine1','45 Malviya Nagar'],['city','Jaipur'],['postalCode','302017']]) await p.fill(`input[name=${n}]`,v); await p.selectOption('select','Rajasthan'); };
let pass=0, fail=0; const ok=(c,m)=>{c?pass++:fail++; console.log(c?'PASS':'FAIL',m)};
await p.goto(BASE+'/product/lx-test-3'); await p.waitForTimeout(3000);
ok(!(await txt()).includes('App Crashed') && /test fabric 3/i.test(await txt()), 'direct product link renders');
ok(!(await txt()).includes('128 Reviews'), 'no fake reviews badge');
await p.getByRole('button',{name:'ACCEPT'}).click().catch(()=>{});
await p.getByRole('button',{name:'42',exact:true}).click(); await p.getByRole('button',{name:/add to cart/i}).click(); await p.waitForTimeout(1200);
await p.goto(BASE+'/checkout'); await p.waitForTimeout(3000);
ok(await p.locator('input[name=fullName]').count()===1, 'guest reaches checkout form (no login wall)');
await fill(); await p.locator('input[name=pay]').nth(1).check(); await p.waitForTimeout(400);
await p.getByRole('button',{name:/place order/i}).click(); await p.waitForTimeout(6000);
ok(p.url().endsWith('/order-confirmation') && (await txt()).includes('₹7,500'), 'guest COD order -> confirmation with server price ₹7,500');
await p.goto(BASE+'/product/lx-test-1'); await p.waitForTimeout(2500);
await p.getByRole('button',{name:'38',exact:true}).click(); await p.getByRole('button',{name:/add to cart/i}).click(); await p.waitForTimeout(1200);
await p.goto(BASE+'/checkout'); await p.waitForTimeout(2500); await fill(); await p.locator('input[name=pay]').nth(0).check();
await p.getByRole('button',{name:/place order/i}).click(); await p.waitForTimeout(7000);
ok(v2, 'online payment calls createRazorpayOrderV2');
ok(await p.locator('iframe[src*="razorpay"]').count()>0, 'Razorpay window opens');
ok(errs.length===0, 'no page crashes '+JSON.stringify(errs));
console.log(`RESULT pass=${pass} fail=${fail}`); await b.close(); process.exit(fail?1:0);
