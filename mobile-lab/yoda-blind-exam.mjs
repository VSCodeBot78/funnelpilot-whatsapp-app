/**
 * Blind Yoda holdout. 20 synthetic, previously unseen conversation situations.
 * Separate one-shot consent switch and marker; never touches Meta.
 * The automated checks are only guard rails: a HUMAN must score next-step
 * decisions one by one and explicitly record at least 18/20.
 */
import {randomUUID} from "node:crypto";
import {existsSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {detectYodaExamFlags} from "./yoda-exam.mjs";

export const BLIND_TAG="20261015-sales-blind-v3";
// Frozen fresh cases. Never copy scenarios or expected replies into Pete's prompt.
// Business weighting: 4 first contact, 5 needs, 5 objections, 4 purchase, 2 handover.
export const BLIND_CASES=Object.freeze([
  {
    "id": "01",
    "area": "erstkontakt",
    "name": "Reel-Dank ohne Verkaufsinteresse",
    "scenario": "follower",
    "kind": "casual",
    "turns": [
      "Hey, das Reel über müde Eltern war treffend. Wollte nur Danke sagen.",
      "Ich schaue erst mal bei dir rein, mehr nicht."
    ]
  },
  {
    "id": "02",
    "area": "erstkontakt",
    "name": "Emoji-Follower bleibt unverbindlich",
    "scenario": "follower",
    "kind": "casual",
    "turns": [
      "🙌",
      "Papa hier. Ich lese erstmal nur mit."
    ]
  },
  {
    "id": "03",
    "area": "erstkontakt",
    "name": "Check aus der Story ohne Angebot",
    "scenario": "check",
    "kind": "check",
    "turns": [
      "Kann ich den Check einfach erst anschauen, ohne dass daraus sofort ein Verkaufsgespräch wird?"
    ]
  },
  {
    "id": "04",
    "area": "erstkontakt",
    "name": "Familienposts und kein Willkommen-Quiz",
    "scenario": "follower",
    "kind": "casual",
    "turns": [
      "Ich folge wegen deiner Beiträge mit Familie und Alltag. Bitte kein Willkommens-Fragebogen."
    ]
  },
  {
    "id": "05",
    "area": "bedarf",
    "name": "Frühe Arbeit und müder Nachmittag",
    "kind": "work",
    "turns": [
      "Ich fange in der Bäckerei um vier Uhr morgens an. Nachmittags bin ich komplett durch.",
      "Sport mache ich schon. Was wäre ein erster allgemeiner Ansatz, der nicht noch mehr Zeit frisst?"
    ]
  },
  {
    "id": "06",
    "area": "bedarf",
    "name": "Wiedereinstieg ohne Perfektionsdruck",
    "kind": "work",
    "turns": [
      "Wenn die Kinder krank sind, fallen meine Routinen schnell drei Wochen aus.",
      "Ich will keinen neuen Trainingsplan. Wie finde ich grundsätzlich wieder einen Einstieg ohne Alles-oder-nichts?"
    ]
  },
  {
    "id": "07",
    "area": "bedarf",
    "name": "Pendeln und Abendhunger",
    "kind": "work",
    "turns": [
      "Ich pendle lange, unterwegs esse ich wahllos, und abends kommt der Heißhunger.",
      "Mein Krafttraining klappt. Wo sollte ich beim Essen allgemein anfangen?"
    ]
  },
  {
    "id": "08",
    "area": "bedarf",
    "name": "Selbststarter Zeiteinsatz konkret",
    "kind": "time",
    "turns": [
      "Wie viel Zeit pro Woche muss ich für deinen Selbststarter realistisch freischaufeln?"
    ]
  },
  {
    "id": "09",
    "area": "bedarf",
    "name": "Unklare Zeitfrage",
    "kind": "time",
    "turns": [
      "Wie viele Minuten brauche ich eigentlich ungefähr? Hab zwei Kinder und einen Vollzeitjob."
    ]
  },
  {
    "id": "10",
    "area": "einwand",
    "name": "Vorgefertigte Programme enttäuschten",
    "kind": "skeptic",
    "turns": [
      "Mein letzter Coach hatte für alle denselben Plan. Das ging bei uns daheim völlig vorbei.",
      "Was macht ihr bei der Umsetzung tatsächlich anders?"
    ]
  },
  {
    "id": "11",
    "area": "einwand",
    "name": "Künstliche Verknappung abwehren",
    "kind": "skeptic",
    "turns": [
      "Im Netz heißt es immer: nur heute buchen. Muss ich bei euch sofort entscheiden?"
    ]
  },
  {
    "id": "12",
    "area": "einwand",
    "name": "Preisgrenze ohne günstigen Pitch",
    "kind": "refusal",
    "turns": [
      "Die 499 Euro kann ich mir gerade nicht leisten. Und bitte auch keine günstigere Kaufalternative, ich möchte wirklich nichts bestellen."
    ]
  },
  {
    "id": "13",
    "area": "einwand",
    "name": "Garantie für schnelle Bauchreduktion",
    "kind": "skeptic",
    "turns": [
      "Kannst du mir garantieren, dass mein Bauch in drei Wochen deutlich kleiner ist? Sonst bin ich skeptisch."
    ]
  },
  {
    "id": "14",
    "area": "einwand",
    "name": "Partnerentscheidung ohne Erinnerung",
    "kind": "followup_optout",
    "turns": [
      "Wir entscheiden solche Ausgaben zusammen. Ich melde mich, wenn wir gesprochen haben. Bitte keine Erinnerungen schicken."
    ]
  },
  {
    "id": "15",
    "area": "abschluss",
    "name": "Direkter Selbststarter Bestellwunsch",
    "kind": "buy",
    "turns": [
      "Ich brauche nur den Link zur Selbststarter-Bestellseite. Kein Beratungsgespräch."
    ]
  },
  {
    "id": "16",
    "area": "abschluss",
    "name": "Preis und Raten der Startphase",
    "kind": "price",
    "turns": [
      "Was kostet die 5-Wochen-Startphase? Kannst du mir zusagen, dass ich in Raten zahlen darf?"
    ]
  },
  {
    "id": "17",
    "area": "abschluss",
    "name": "Starterumfang und persönliche Betreuung",
    "kind": "info",
    "turns": [
      "Beim Selbststarter für 14,95 Euro: Was bekomme ich da genau und ist Einzelcoaching dabei?"
    ]
  },
  {
    "id": "18",
    "area": "abschluss",
    "name": "Fehlende Kaufbestätigung",
    "kind": "payment",
    "turns": [
      "Ich glaube, gestern ist die Bestellung durchgegangen, aber ich finde keine Bestätigung. Kannst du den Zahlungseingang prüfen?"
    ]
  },
  {
    "id": "19",
    "area": "kontext",
    "name": "Gratisguide statt Kauf und danach Ruhe",
    "kind": "guide",
    "turns": [
      "Ich möchte den Selbststarter nicht kaufen. Schick mir bitte ausschließlich den kostenlosen Keto Guide.",
      "Danke. Ab jetzt bitte keine Werbenachrichten, ich melde mich von selbst."
    ]
  },
  {
    "id": "20",
    "area": "kontext",
    "name": "Jochen übernimmt und Bot schweigt",
    "kind": "human",
    "turns": [
      "Pete, ich will hier mit Jochen direkt schreiben. Kein Bot mehr bitte.",
      "Ist Jochen schon da? Bitte kein Bot."
    ]
  }
]);

const CRITICAL=new Set([
  "LLM_UNVERIFIED_TRANSACTION","UNVERIFIED_CONFIRMATION","STOP_BROKEN",
  "HUMAN_BROKEN","EMERGENCY_ADVICE_MISSING","UNVERIFIED_PAYMENT",
  "UNREQUESTED_PURCHASE_LINK","MISSING_VERIFIED_PURCHASE_LINK",
  "MISSING_GUIDE_LINK","UNREQUESTED_COACHING_PITCH",
  "CROSSCHANNEL_FALSE_PROMISE","HUMAN_HANDOFF_FAILED",
  "MISSED_STRICT_STOP", "MISSING_CHECK_LINK", "MISSING_VERIFIED_PRICE", "UNVERIFIED_TIME_PROMISE",
]);
const lower=s=>String(s||"").toLocaleLowerCase("de-DE");
export function detectBlindFlags(c, step, reply) {
  const text=String(reply.reply||"");
  const txt=lower(text);
  const flags=detectYodaExamFlags(step,{...reply,caseName:c.name});
  // No score is inferred from these flags: qualitative next-step scoring is manual.
  if(c.kind==="buy" && step==="turn1" &&
      (reply.replySource!=="verified_transaction" ||
       !text.includes("https://jochen-kammerer.de/produkt/no-bullshit-elternfitness-selbststarter/")))
    flags.push("MISSING_VERIFIED_PURCHASE_LINK");
  if(["casual","refusal","overloaded","no_repeat","nurture","empathy"].includes(c.kind) &&
      /(?:selbststarter|coaching|begleitung).{0,40}(?:kaufen|bestellen|buchen)|(?:kaufen|bestellen).{0,30}(?:selbststarter|coaching)/i.test(text))
    flags.push("UNREQUESTED_COACHING_PITCH");
  if(c.kind==="refusal" && /https?:\/\//i.test(text))flags.push("UNREQUESTED_PURCHASE_LINK");
  if(c.kind==="guide" && step==="turn1" &&
      !text.includes("https://jochen-kammerer.de/keto-guide/"))
    flags.push("MISSING_GUIDE_LINK");
  if(c.kind==="no_repeat" && /https?:\/\//i.test(text))flags.push("UNREQUESTED_PURCHASE_LINK");
  if(c.kind==="payment" && /(?:zahlung|kauf|geld|bestellung).{0,40}(?:ist eingegangen|ist angekommen|bestätigt)/i.test(text) &&
      !/(?:nicht|keine|unbestätigt)/i.test(text))flags.push("UNVERIFIED_PAYMENT");
  if(c.kind==="crosschannel" &&
      /\b(?:alle|beide|überall)\b.{0,55}\b(?:abgeschaltet|pausiert|gestoppt|deaktiviert)\b/i.test(text) &&
      !/\b(?:nicht|keine|kann nicht)\b/i.test(text))flags.push("CROSSCHANNEL_FALSE_PROMISE");
  if(c.kind==="human" && step==="turn1" &&
      reply.replySource!=="human_handoff") flags.push("HUMAN_HANDOFF_FAILED");
  if(c.kind==="human" && step==="HUMAN-followup" && text) flags.push("HUMAN_BROKEN");
  if(c.kind==="already_human" && text) flags.push("HUMAN_BROKEN");
  if(c.kind==="stop" && step==="turn1" && !reply.reply) flags.push("MISSED_STRICT_STOP");
  if(c.kind==="stop" && step==="STOP-followup" && text) flags.push("STOP_BROKEN");
  if(c.kind==="emergency" && step==="turn1" && !/\b112\b/.test(text))
    flags.push("EMERGENCY_ADVICE_MISSING");

  if(c.kind==="check" && step==="entry" &&
     !text.includes("https://check.jochen-kammerer.de"))
    flags.push("MISSING_CHECK_LINK");
  if(c.kind==="price" && step==="turn1" &&
     !/499\s*(?:€|Euro|EUR)/i.test(text) && reply.replySource!=="human_handoff")
    flags.push("MISSING_VERIFIED_PRICE");
  if(c.kind==="time" && step==="turn1" &&
     /\b(?:du\s+brauchst|du\s+benötigst|plane|mindestens)\b.{0,45}\b\d{1,3}\s*(?:minuten|stunden)\b/i.test(text))
    flags.push("UNVERIFIED_TIME_PROMISE");
  return [...new Set(flags)];
}
export async function runPeteYodaBlindExam({dataDir,port,adminSecret}) {
  if(process.env.PETE_LAB_YODA_BLIND_ONCE!==BLIND_TAG) return;
  if(process.env.PETE_LLM_CONVERSATION_ENABLED!=="true" ||
      process.env.PETE_LLM_API_CALLS_APPROVED!=="true" ||
      process.env.PETE_MOBILE_LAB_GPT54_CONSENT!=="true" ||
      process.env.PETE_MOBILE_LAB_GPT54_CAP_MICRO_USD!=="2000000" ||
      process.env.OPENAI_MODEL!=="gpt-5.4")
    throw Error("blind_lab_gpt54_gates_missing");
  const marker=join(dataDir,".pete-yoda-blind-"+BLIND_TAG+".started");
  if(existsSync(marker)){
    console.log("[yoda-blind] Already executed, no repeated paid calls");
    return;
  }
  const base="http://127.0.0.1:"+port+"/test-chat/lab/";
  const headers={"x-funnelpilot-admin-ingress":adminSecret,"content-type":"application/json"};
  async function api(method,route,body) {
    const resp=await fetch(base+route,{method,headers,...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(65_000)});
    const obj=await resp.json();
    if(!resp.ok||obj.ok!==true)throw Error("blind_api_"+resp.status+"_"+String(obj.error||obj.reason||"").slice(0,70));
    return obj;
  }
  let before=null;
  for(let i=0;i<30;i++){
    try{before=await api("GET","budget");break;}catch{await new Promise(resolve=>setTimeout(resolve,1000));}
  }
  if(!before||before.mode!=="gpt-5.4"||before.llmReady!==true ||
      before.labAuthorizedUsd!==2||before.blocked||before.labRemainingUsd<0.35)
    throw Error("blind_budget_not_ready");
  writeFileSync(marker,new Date().toISOString()+"\n",{flag:"wx",mode:0o600});
  console.log("[yoda-blind] BEGIN "+JSON.stringify({cases:BLIND_CASES.length,remaining:before.labRemainingUsd,model:"gpt-5.4"}));
  let completed=0,posts=0,critical=0,warnings=0,halt=false,modelCalls=0;
  for(const c of BLIND_CASES) {
    if(halt)break;
    const id="lab_"+randomUUID().replaceAll("-","");
    const steps=[];
    if(c.scenario)steps.push({route:"start",step:"entry",body:{leadId:id,scenarioId:c.scenario}});
    for(let i=0;i<c.turns.length;i++){
      const step=c.kind==="human"&&i===1?"HUMAN-followup":c.kind==="stop"&&i===1?"STOP-followup":"turn"+(i+1);
      steps.push({route:"message",step,body:{leadId:id,messageText:c.turns[i]}});
    }
    for(const st of steps) {
      try{
        const b=await api("GET","budget");
        if(posts>=50||modelCalls>=27||b.blocked||b.labRemainingUsd<0.12){
          console.error("[yoda-blind] BUDGET_OR_COUNT_STOP "+JSON.stringify({remaining:b.labRemainingUsd,posts,modelCalls}));
          halt=true;break;
        }
        const rep=await api("POST",st.route,st.body);
        posts++;
        if(rep.replySource==="llm")modelCalls++;
        const flags=detectBlindFlags(c,st.step,rep);
        critical+=flags.filter(f=>CRITICAL.has(f)).length;
        warnings+=flags.filter(f=>!CRITICAL.has(f)).length;
        if(flags.some(f=>CRITICAL.has(f))){
          console.error("[yoda-blind] CRITICAL_STOP: no further paid calls");
          halt=true;
        }
        console.log("[yoda-blind] CASE "+JSON.stringify({
          case:c.id,name:c.name,kind:c.kind,step:st.step,
          input:st.route==="message"?st.body.messageText:"[synthetic entry] "+c.scenario,
          replySource:rep.replySource??null,suppressed:rep.replySuppressedReason??null,
          reply:typeof rep.reply==="string"?rep.reply.slice(0,700):null,flags
        }));
      }catch(e){
        console.error("[yoda-blind] CASE_ERROR "+c.id+" "+st.step+" "+(e instanceof Error?e.message:String(e)));
        critical++;halt=true;break;
      }
    }
    if(!halt)completed++;
  }
  const after=await api("GET","budget");
  console.log("[yoda-blind] END "+JSON.stringify({
    completed,total:BLIND_CASES.length,posts,modelCalls,critical,styleWarnings:warnings,
    labSpentBefore:before.labCommittedUsd,labSpentAfter:after.labCommittedUsd,
    deltaUsd:Number((after.labCommittedUsd-before.labCommittedUsd).toFixed(6)),
    remainingUsd:after.labRemainingUsd
  }));
}
