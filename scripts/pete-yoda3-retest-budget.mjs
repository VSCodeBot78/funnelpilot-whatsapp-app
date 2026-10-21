import fs from "node:fs";
import path from "node:path";
// Owner approved up to USD5 new Yoda3 QA. This one-time batch holds only USD2
// because the existing project-wide USD8 ledger has USD2.990186 remaining.
// Never lift or reset the project-wide ceiling without separate approval.
const operation=process.argv[2], ref="refs/heads/pete-yoda3-retest-20261021";
const key="approved-yoda3-retest-20261021-usd1-from-new-usd5";
const hold=1_000_000, file=path.resolve("budget-ledger/phase3-budget-ledger.json");
if (process.argv.length!==3 || !["reserve","settle"].includes(operation) ||
    process.env.GITHUB_ACTIONS!=="true" || process.env.GITHUB_REF!==ref ||
    process.env.PETE_YODA3_QA_20261021!=="true" ||
    process.env.PETE_YODA3_APPROVAL!=="single-retest-20261021-usd5" ||
    !/^[0-9]{5,}$/.test(process.env.GITHUB_RUN_ID??""))
  throw Error("yoda3_unauthorized");
const d=JSON.parse(fs.readFileSync(file,"utf8"));
if(d.version!==1 || d.capMicroUsd!==8_000_000 ||
   !Number.isSafeInteger(d.spentMicroUsd) || d.spentMicroUsd<0 ||
   !Number.isSafeInteger(d.reservedMicroUsd) || d.reservedMicroUsd<0 ||
   !d.activeReservations || Array.isArray(d.activeReservations) ||
   !Array.isArray(d.completedBatches) ||
   d.qualityRound2_20261021?.status!=="settled" ||
   d.qualityRound2_20261021?.chargedMicroUsd!==89_138 ||
   Object.values(d.activeReservations).reduce((n,v)=>n+Number(v.heldMicroUsd),0)!==d.reservedMicroUsd ||
   d.spentMicroUsd+d.reservedMicroUsd>d.capMicroUsd)
 throw Error("yoda3_ledger_invalid");
if(operation==="reserve"){
 if(d.yoda3Retest_20261021 || d.activeReservations[key] ||
    d.completedBatches.some(x=>x.id===key) ||
    d.reservedMicroUsd!==0 || d.spentMicroUsd+hold>d.capMicroUsd)
   throw Error("yoda3_reservation_denied");
 d.activeReservations[key]={heldMicroUsd:hold,createdAt:new Date().toISOString()};
 d.reservedMicroUsd+=hold;
 d.yoda3Retest_20261021={runId:process.env.GITHUB_RUN_ID,reserveMicroUsd:hold,status:"reserved"};
}else{
 const q=d.yoda3Retest_20261021;
 if(q?.status!=="reserved" || q.runId!==process.env.GITHUB_RUN_ID ||
    q.reserveMicroUsd!==hold || d.activeReservations[key]?.heldMicroUsd!==hold)
   throw Error("yoda3_settle_denied");
 let charge=hold;
 try{
  const local=JSON.parse(fs.readFileSync("backend/.pete-yoda3-retest-20261021/pete-api-budget.json","utf8"));
  if(local.version===1 && Number.isSafeInteger(local.committedMicroUsd) &&
     local.committedMicroUsd>=0 && local.committedMicroUsd<=hold &&
     Number.isSafeInteger(local.requestsStarted) && local.requestsStarted>0)
    charge=local.committedMicroUsd;
 }catch{/* Unknown usage consumes entire reservation. */}
 d.spentMicroUsd+=charge;d.reservedMicroUsd-=hold;delete d.activeReservations[key];
 d.completedBatches.push({id:key,costMicroUsd:charge,completedAt:new Date().toISOString()});
 q.status="settled";q.chargedMicroUsd=charge;
}
fs.writeFileSync(file,JSON.stringify(d,null,2)+"\n",{mode:0o600});
console.log("Yoda3 "+operation+"; held USD 1.00 maximum; one-time under new USD5 approval and existing USD8 ceiling");
