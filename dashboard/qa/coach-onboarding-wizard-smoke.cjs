const {chromium}=require('@playwright/test');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:false});
 const page=await context.newPage();page.setDefaultTimeout(5500);
 const writes=[],external=[],errors=[],checks=[];
 const ck=(name,ok)=>checks.push({name,result:ok?'PASS':'FAIL'});
 await page.route('**/*',route=>{
  const r=route.request(),u=new URL(r.url());
  if(!['localhost','127.0.0.1'].includes(u.hostname)){external.push(r.url());return route.abort();}
  if(!['GET','HEAD','OPTIONS'].includes(r.method())){writes.push(r.method()+' '+u.pathname);return route.abort();}
  return route.continue();
 });
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded',timeout:20000});
  const d=page.getByRole('dialog');await d.waitFor({state:'visible',timeout:12000});
  const flagBefore=await page.evaluate(()=>localStorage.getItem('funnelpilot-onboarding-complete-v1'));
  ck('Real wizard six stages available',await d.locator('button').filter({hasText:/^[1-6]\. /}).count()===6);
  const x=page.getByRole('button',{name:/X-Wing: Erststart offline testen/});
  ck('Dry-run launch button visible in setup dialog',await x.count()===1);
  let launchReachable=true;try{await x.click({trial:true,timeout:800});}catch{launchReachable=false;}
  ck('Dry-run launch button reachable with real click',launchReachable);
  if(await x.count()!==1)throw Error('xwing launch missing');
  await x.click(); // genuine accessible browser click; no DOM bypass
  ck('X-Wing dry-run opens without live activation',await d.getByText(/X-Wing: Erststart offline testen/).isVisible());
  await d.getByRole('button',{name:/Direkt einrichten/}).click();
  ck('Step 2 brand exists',await d.getByText('Schritt 2 von 6').isVisible());
  ck('Synthetic profile is initially blank',await d.getByLabel('Firmenname / Marke').inputValue()==='');
  await d.getByRole('button',{name:/^Weiter/}).click();
  ck('Required operator and assistant validation',await d.getByText(/Bitte Betreiber- und Assistentennamen angeben/).isVisible());
  await d.getByLabel('Firmenname / Marke').fill('Mustercoach Testmarke');
  await d.getByLabel('Website').fill('https://example.invalid');
  await d.getByLabel('Nische / Schwerpunkt').fill('Alltagsbewegung');
  await d.getByLabel('Zielgruppe').fill('Berufstaetige Eltern');
  await d.getByLabel('Betreibername').fill('Testcoach');
  await d.getByLabel('Assistentenname').fill('Testbot');
  await d.getByLabel('Master-Prompt: So soll dein KI-Assistent mit Leads sprechen').fill('Nur eine Frage pro Nachricht. Keine Zahlungsversprechen.');
  await d.getByRole('button',{name:/^Weiter/}).click();
  ck('Step 3 offers reached',await d.getByText('Schritt 3 von 6').isVisible());
  await d.getByLabel('Deine Angebote und Zielsetzung').fill('Muster-Coaching, 99 Euro');
  await d.getByLabel('Buchungslink (falls vorhanden)').fill('https://example.invalid/termin');
  await d.getByLabel('Kauf-Link für dein Haupteinstiegsangebot').fill('https://example.invalid/kauf');
  await d.getByLabel('Markenname').fill('Mustercoach Testmarke');
  await d.getByRole('button',{name:/Angebot hinzufügen/}).click();
  ck('Offer draft editor available',await d.getByText('Angebot 1',{exact:true}).isVisible());
  await d.getByRole('button',{name:/FAQ hinzufügen/}).click();
  ck('FAQ draft editor available',await d.getByText('FAQ 1',{exact:true}).isVisible());
  await d.getByRole('button',{name:/Coach-Entwurf speichern/}).click();
  ck('Draft save explicitly stays in memory',await d.getByText(/flüchtigen X-Wing-Testprofil/).count()>0);
  await d.getByRole('button',{name:/^Weiter/}).click();
  ck('Step 4 connections reached',await d.getByText('Schritt 4 von 6').isVisible());
  ck('All 6 connections require simulation only',await d.getByRole('button',{name:/Verbindung simulieren/}).count()===6);
  for(let i=0;i<6;i++)await d.getByRole('button',{name:/Verbindung simulieren/}).first().click();
  ck('All six remain explicitly demo connections',await d.getByText(/Nur Demo: verbunden simuliert/).count()===6);
  await d.getByRole('button',{name:/^Weiter/}).click();
  ck('Step 5 test reached',await d.getByText('Schritt 5 von 6').isVisible());
  ck('Paid purchase and active Pete actions absent in dry-run',await d.getByRole('button',{name:/Testkauf|Pete-Testgespräch öffnen/}).count()===0);
  await d.getByRole('button',{name:/^Weiter/}).click();
  ck('Step 6 dry-run summary reached',await d.getByText(/Einrichtungsablauf durchgespielt/).isVisible());
  ck('Summary says NOT live-connected',await d.getByText(/Keine echte Verbindung, keine Live-Freigabe/).count()>0);
  await d.getByRole('button',{name:/^Trockenlauf schließen/}).click();
  await page.waitForTimeout(300);
  ck('Rehearsal closes without marking real setup complete',await d.isVisible() && await d.getByText(/Funnel Pilot einrichten/).count()>0);
  await d.getByRole('button',{name:/^4\. Verbindungen/}).click();
  ck('Real wizard can navigate to connections',await d.getByText('Schritt 4 von 6').isVisible());
  await d.getByRole('button',{name:/X-Wing: Erststart offline testen/}).click();
  ck('X-Wing restarts at step 1 even from real step 4',await d.getByText('Schritt 1 von 6').isVisible());
  await d.getByRole('button',{name:/Direkt einrichten/}).click();
  ck('Second X-Wing starts with an empty identity',await d.getByLabel('Firmenname / Marke').inputValue()==='');
  await d.getByRole('button',{name:/Einrichtung schließen/}).click();
  const flagAfter=await page.evaluate(()=>localStorage.getItem('funnelpilot-onboarding-complete-v1'));
  ck('Live onboarding completion flag unchanged',flagBefore===flagAfter);
  ck('No HTTP writes requested',writes.length===0);
  ck('No external provider requests',external.length===0);
  ck('No page runtime exceptions',errors.length===0);
  console.log('QA_RESULTS',JSON.stringify(checks));
  console.log('QA_TOTAL',JSON.stringify({pass:checks.filter(c=>c.result==='PASS').length,fail:checks.filter(c=>c.result==='FAIL').length,total:checks.length,writes,external:external.slice(0,5),errors}));
  if(checks.some(c=>c.result==='FAIL'))process.exitCode=2;
 }catch(e){console.log('QA_FATAL',e.stack);console.log('RESULTS_SO_FAR',JSON.stringify(checks));process.exitCode=1;}finally{await browser.close();}
})();