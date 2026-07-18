var y=Object.defineProperty;var N=Object.getOwnPropertyDescriptor;var O=Object.getOwnPropertyNames;var P=Object.prototype.hasOwnProperty;var F=(e,t)=>{for(var n in t)y(e,n,{get:t[n],enumerable:!0})},M=(e,t,n,a)=>{if(t&&typeof t=="object"||typeof t=="function")for(let s of O(t))!P.call(e,s)&&s!==n&&y(e,s,{get:()=>t[s],enumerable:!(a=N(t,s))||a.enumerable});return e};var L=e=>M(y({},"__esModule",{value:!0}),e);var V={};F(V,{default:()=>J});module.exports=L(V);var h="The CRM didn't respond \u2014 please try again in a minute.",l=class extends Error{constructor(t,n){super(t),this.name="CrmError",this.detail=n}};function U(e){let{apiUrl:t,agentKey:n}=e,a=e.fetchFn??fetch;return{baseUrl:t.replace(/\/api\/graphql\/?$/,""),async query(o,i){let d;try{d=await a(t,{method:"POST",headers:{"content-type":"application/json","x-agent-key":n},body:JSON.stringify({query:o,variables:i})})}catch(r){throw new l(h,r instanceof Error?r.message:String(r))}if(!d.ok)throw new l(h,`HTTP ${d.status}`);let c;try{c=await d.json()}catch(r){throw new l(h,`invalid JSON response: ${r instanceof Error?r.message:String(r)}`)}if(c.errors?.length)throw new l(`The CRM rejected the request: ${c.errors.map(r=>r.message).join("; ")}`);if(c.data===void 0||c.data===null)throw new l(h,"empty data");return c.data}}}function S(){let e=env("CRM_API_URL"),t=env("CRM_AGENT_KEY");if(!e)throw new l("Agent misconfigured: CRM_API_URL is not set.");if(!t)throw new l("Agent misconfigured: CRM_AGENT_KEY is not set.");return U({apiUrl:e,agentKey:t})}var m="activities { type subject body occurredAt channel direction }",q={client:{rootField:"client",document:`
      query AgentClient($id: ID!) {
        client(id: $id) {
          id name sector status hqCity hqCountry website description
          revenueLastYear revenueForecast currency profitability existingInvestors staffCount
          createdAt updatedAt
          contacts { firstName lastName email jobTitle isPrimaryContact }
          mandates { id name stage dealSize currency nextAction stageEnteredAt }
          transactions { id name stage targetRaise currency dealStatus stageEnteredAt }
          ${m}
        }
      }
    `},investor:{rootField:"investor",document:`
      query AgentInvestor($id: ID!) {
        investor(id: $id) {
          id name investorType status website sectorFocus geographicFocus instruments
          investmentStages aum ticketMin ticketMax currency esgFocus ndaStatus onboardingStatus
          engagementClassification nextActionDate feedback notes createdAt updatedAt
          contacts { firstName lastName email jobTitle isPrimaryContact }
          engagements {
            id name status engagementStage interestLevel lastContact totalAmount probability
            transaction { id name stage }
          }
          ${m}
        }
      }
    `},mandate:{rootField:"mandate",document:`
      query AgentMandate($id: ID!) {
        mandate(id: $id) {
          id name stage stageEnteredAt daysInStage dealStatus dealSize currency sector source
          dateOpened ndaStatus ndaSignedDate eaStatus eaSignedDate nextAction notes
          retainerAmount priority createdAt updatedAt leadId
          client { id name }
          transactions { id name stage }
          ${m}
        }
      }
    `},transaction:{rootField:"transaction",document:`
      query AgentTransaction($id: ID!) {
        transaction(id: $id) {
          id name stage stageEnteredAt dealType instrument targetRaise currency sector
          dateOpened closedAt dealStatus dealMilestone financingType probability notes priority
          activeConversations createdAt updatedAt ownerId
          client { id name }
          mandate { id name stage }
          engagements {
            id name status engagementStage interestLevel lastContact totalAmount termSheetIssued
            investor { id name }
          }
          ${m}
        }
      }
    `},engagement:{rootField:"engagement",document:`
      query AgentEngagement($id: ID!) {
        engagement(id: $id) {
          id name status engagementStage interestLevel ndaType ndaSignedAt termSheetIssued termSheetDate
          totalAmount amountDisbursed amountPending disbursementStatus probability feedback notes
          lastContact createdAt updatedAt
          transaction { id name stage client { id name } }
          investor { id name investorType }
          milestones { key completedAt notes }
          ${m}
        }
      }
    `},partner:{rootField:"partner",document:`
      query AgentPartner($id: ID!) {
        partner(id: $id) {
          id name partnerType status location organization email phone profile
          feeSharingAgreement feeSharingTerms partnerAgreementStatus internalOnly feedbackNotes
          createdAt updatedAt
          contacts { firstName lastName email }
          referredMandates { id name stage }
        }
      }
    `}};var B=`
  query TrackerEngagement($id: ID!) {
    engagement(id: $id) {
      id name status engagementStage interestLevel ndaType ndaSignedAt
      termSheetIssued termSheetDate totalAmount amountDisbursed amountPending
      disbursementStatus dateReceived probability feedback notes
      lastContact createdAt updatedAt transactionId investorId
      transaction {
        id name stage dealStatus
        client { id name }
        ddTracks { track status notes startedAt completedAt }
      }
      investor { id name investorType engagementClassification ndaStatus }
      milestones { key completedAt notes }
      ${m}
    }
  }
`,b=`
  query TrackerEngagementsByDeal {
    engagementsByDeal {
      transaction { id name stage dealStatus client { id name } }
      engagements {
        id name engagementStage interestLevel lastContact updatedAt
        termSheetIssued termSheetDate totalAmount amountDisbursed amountPending
        disbursementStatus
        investor { id name engagementClassification }
      }
    }
  }
`;var A=`
  mutation TrackerCreateTask($input: TaskInput!) {
    createTask(input: $input) { id title status dueAt }
  }
`;var D={Shared:14,TeaserSent:10,NDASigned:14,IMShared:14,VDRAccess:21,Meeting:10,InfoRequest:7,DueDiligence:21,TermSheet:14,Offer:7,Invested:30};function Y(e){if(!e)return D;try{let t=JSON.parse(e),n={...D};for(let[a,s]of Object.entries(t))a in n&&typeof s=="number"&&s>0&&(n[a]=s);return n}catch{return console.warn("TRACKER_STALE_DAYS is not valid JSON \u2014 using default thresholds."),D}}function v(){return Y(env("TRACKER_STALE_DAYS"))}var j=1440*60*1e3;function k(e,t){let n=[t.lastContact,t.updatedAt].filter(a=>!!a).map(a=>new Date(a).getTime()).filter(a=>Number.isFinite(a));return n.length===0?Number.POSITIVE_INFINITY:Math.floor((e.getTime()-Math.max(...n))/j)}var G=new Set(["Open","ClosedReopened"]);function K(e,t,n){if(!G.has(t.dealStatus))return[];if(e.engagementStage==="Declined")return[];let a=[],s={engagementId:e.id,stage:e.engagementStage,investor:{id:e.investor.id,name:e.investor.name},transaction:{id:t.id,name:t.name},link:`${n.baseUrl}/engagement/${e.id}`},o=k(n.now,e);if(e.engagementStage==="Invested"){let i=e.amountPending??0;if(e.disbursementStatus==="Ongoing"&&i>0){let d=n.thresholds.Invested;o>=d&&a.push({...s,reason:"disbursement_outstanding",detail:`Disbursement ongoing with ${i.toLocaleString()} still pending, no touch in ${o} days.`,idleDays:o,thresholdDays:d})}}else{let i=n.thresholds[e.engagementStage];i!==void 0&&o>=i&&a.push({...s,reason:"stalled",detail:`No touch in ${o} days at stage ${e.engagementStage} (threshold ${i}d).`,idleDays:o,thresholdDays:i})}return e.termSheetIssued&&!e.termSheetDate&&a.push({...s,reason:"term_sheet_undated",detail:"Term sheet is marked issued but has no date recorded.",idleDays:o,thresholdDays:null}),a}async function w(e,t={}){let n=e.now?e.now():new Date,a=await e.crm.query(b),s={thresholds:e.thresholds,now:n,baseUrl:e.crm.baseUrl},o=[];for(let i of a.engagementsByDeal)if(!(t.transactionId&&i.transaction.id!==t.transactionId))for(let d of i.engagements)t.investorId&&d.investor.id!==t.investorId||o.push(...K(d,i.transaction,s));return o.sort((i,d)=>d.idleDays-i.idleDays)}function C(e){let t=new Date(Date.UTC(e.getUTCFullYear(),e.getUTCMonth(),e.getUTCDate())),n=t.getUTCDay();return t.setUTCDate(t.getUTCDate()-(n+6)%7),t.toISOString().slice(0,10)}var E="staff_users";var u=require("zod");var R="Created by Investor Tracker Agent";function _(e,t){let n=new Date(e),a=t;for(;a>0;){n.setDate(n.getDate()+1);let s=n.getDay();s!==0&&s!==6&&(a-=1)}return n}var _e=u.z.object({title:u.z.string().min(1).describe("Short imperative task title, e.g. 'Follow up with Vantage on the term sheet'"),body:u.z.string().optional().describe("Context for whoever picks the task up"),dueAt:u.z.string().optional().describe("ISO datetime the task is due \u2014 defaults to 3 business days from now"),engagementId:u.z.string().optional().describe("Preferred \u2014 links the task to both the deal and the investor automatically"),investor:u.z.string().optional().describe("Investor name/id, used with deal when engagementId is unknown"),deal:u.z.string().optional().describe("Deal name/id, used with investor when engagementId is unknown"),confirmed:u.z.literal(!0).describe("Only pass true after the user has explicitly confirmed this exact task in this conversation. If you have not asked yet, ask first \u2014 do not call this tool.")});var $="tracker_flags";function H(e,t){return`${e.engagementId}:${e.reason}:${C(t)}`}async function z(e){let t=e.now?e.now():new Date,n=await e.scan(),a=0,s=0,o=0,i=[];for(let r of n){let p=H(r,t);if((await e.data.get($,{flagKey:{$eq:p}},1,1)).data.length>0){a+=1;continue}try{await e.createTask({title:`Follow up: ${r.investor.name} \xD7 ${r.transaction.name} (${r.stage}, ${Number.isFinite(r.idleDays)?`${r.idleDays}d idle`:"never touched"})`,body:`${r.detail}
${r.link}
${R} (followup-check).`,status:"NotStarted",source:"Other",dueAt:_(t,3).toISOString(),transactionId:r.transaction.id,investorId:r.investor.id}),s+=1,i.push(r),await e.data.create($,{flagKey:p,engagementId:r.engagementId,reason:r.reason},`tracker flag ${p}`)}catch{o+=1}}let d=0,c=0;if(i.length>0){let r=i.map(g=>`\u2022 ${g.investor.name} \xD7 ${g.transaction.name} \u2014 ${g.detail} ${g.link}`).join(`
`),p=`\u{1F514} Investor Tracker \u2014 ${i.length} engagement${i.length===1?"":"s"} flagged this morning:
${r}
Follow-up tasks have been created.`,T=await e.data.get(E,{},1,100),I=new Set;for(let g of T.data){let f=g.data?.userId;if(!(!f||I.has(f))){I.add(f);try{await e.send(f,p),d+=1}catch{c+=1}}}}return{flagged:n.length,deduped:a,tasksCreated:s,taskFailures:o,notified:d,notifyFailed:c}}var x={name:"followup-check",description:"Weekday 08:00 Nairobi sweep of investor-deal engagements: flags stalled/overdue items, creates deduplicated follow-up tasks for deal leads, and notifies registered staff.",schedule:{type:"cron",expression:"0 8 * * 1-5",timezone:"Africa/Nairobi"},timeout:300,retry:{maxAttempts:3,backoffSeconds:120},execute:async()=>{let e=S();return z({scan:()=>w({crm:e,thresholds:v()}),createTask:t=>e.query(A,{input:t}),data:{create:Data.create,get:Data.get},send:(t,n)=>Channels.send({channel:"webchat",to:{userId:t},text:n})})}};var W={version:"2.0.0",kind:"job",name:"followup-check",description:"Weekday 08:00 Nairobi sweep of investor-deal engagements: flags stalled/overdue items, creates deduplicated follow-up tasks for deal leads, and notifies registered staff.",exportName:"followupCheckJob"},J={__lua_primitive__:W,primitive:x};
