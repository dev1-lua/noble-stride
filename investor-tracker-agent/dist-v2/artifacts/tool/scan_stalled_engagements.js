var f=Object.defineProperty;var x=Object.getOwnPropertyDescriptor;var N=Object.getOwnPropertyNames;var w=Object.prototype.hasOwnProperty;var L=(e,t)=>{for(var n in t)f(e,n,{get:t[n],enumerable:!0})},F=(e,t,n,s)=>{if(t&&typeof t=="object"||typeof t=="function")for(let a of N(t))!w.call(e,a)&&a!==n&&f(e,a,{get:()=>t[a],enumerable:!(s=x(t,a))||s.enumerable});return e};var M=e=>F(f({},"__esModule",{value:!0}),e);var H={};L(H,{ScanStalledEngagementsTool:()=>g,default:()=>z});module.exports=M(H);var S=require("zod");var h="The CRM didn't respond \u2014 please try again in a minute.",c=class extends Error{constructor(t,n){super(t),this.name="CrmError",this.detail=n}};function O(e){let{apiUrl:t,agentKey:n}=e,s=e.fetchFn??fetch;return{baseUrl:t.replace(/\/api\/graphql\/?$/,""),async query(o,r){let i;try{i=await s(t,{method:"POST",headers:{"content-type":"application/json","x-agent-key":n},body:JSON.stringify({query:o,variables:r})})}catch(l){throw new c(h,l instanceof Error?l.message:String(l))}if(!i.ok)throw new c(h,`HTTP ${i.status}`);let d;try{d=await i.json()}catch(l){throw new c(h,`invalid JSON response: ${l instanceof Error?l.message:String(l)}`)}if(d.errors?.length)throw new c(`The CRM rejected the request: ${d.errors.map(l=>l.message).join("; ")}`);if(d.data===void 0||d.data===null)throw new c(h,"empty data");return d.data}}}function I(){let e=env("CRM_API_URL"),t=env("CRM_AGENT_KEY");if(!e)throw new c("Agent misconfigured: CRM_API_URL is not set.");if(!t)throw new c("Agent misconfigured: CRM_AGENT_KEY is not set.");return O({apiUrl:e,agentKey:t})}var D=`
  query AgentGlobalSearch($query: String!, $limit: Int) {
    globalSearch(query: $query, limit: $limit) { id type title subtitle href }
  }
`,m="activities { type subject body occurredAt channel direction }",Q={client:{rootField:"client",document:`
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
    `}};var W=`
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
`,_=`
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
`,v=`
  query TrackerTransactionById($id: ID!) {
    transaction(id: $id) { id name }
  }
`,E=`
  query TrackerInvestorById($id: ID!) {
    investor(id: $id) { id name }
  }
`;var A={client:"Client",investor:"Investor",mandate:"Mandate",transaction:"Transaction",engagement:"Engagement",partner:"Partner"};function b(e,t,n){let s=A[t],a=e.filter(d=>d.type===s);if(a.length===0)return{kind:"none"};let o=a.find(d=>d.id===n);if(o)return{kind:"match",result:o};let r=n.trim().toLowerCase(),i=a.filter(d=>d.title.trim().toLowerCase()===r);return i.length===1?{kind:"match",result:i[0]}:a.length===1?{kind:"match",result:a[0]}:{kind:"ambiguous",candidates:a.slice(0,5)}}var P={transaction:{document:v,rootField:"transaction",hrefPrefix:"/transactions"},investor:{document:E,rootField:"investor",hrefPrefix:"/investors"}};function q(e){return/^c[a-z0-9]{20,32}$/i.test(e.trim())}async function R(e,t,n){let s=await e.query(D,{query:n,limit:10}),a=b(s.globalSearch,t,n);if(a.kind!=="none"||!q(n))return a;let o=P[t];if(!o)return a;try{let i=(await e.query(o.document,{id:n.trim()}))[o.rootField];if(i)return{kind:"match",result:{id:i.id,type:A[t],title:i.name,subtitle:null,href:`${o.hrefPrefix}/${i.id}`}}}catch{}return a}var T={Shared:14,TeaserSent:10,NDASigned:14,IMShared:14,VDRAccess:21,Meeting:10,InfoRequest:7,DueDiligence:21,TermSheet:14,Offer:7,Invested:30};function U(e){if(!e)return T;try{let t=JSON.parse(e),n={...T};for(let[s,a]of Object.entries(t))s in n&&typeof a=="number"&&a>0&&(n[s]=a);return n}catch{return console.warn("TRACKER_STALE_DAYS is not valid JSON \u2014 using default thresholds."),T}}function C(){return U(env("TRACKER_STALE_DAYS"))}var Y=1440*60*1e3;function $(e,t){let n=[t.lastContact,t.updatedAt].filter(s=>!!s).map(s=>new Date(s).getTime()).filter(s=>Number.isFinite(s));return n.length===0?Number.POSITIVE_INFINITY:Math.floor((e.getTime()-Math.max(...n))/Y)}var B=new Set(["Open","ClosedReopened"]);function G(e,t,n){if(!B.has(t.dealStatus))return[];if(e.engagementStage==="Declined")return[];let s=[],a={engagementId:e.id,stage:e.engagementStage,investor:{id:e.investor.id,name:e.investor.name},transaction:{id:t.id,name:t.name},link:`${n.baseUrl}/engagement/${e.id}`},o=$(n.now,e);if(e.engagementStage==="Invested"){let r=e.amountPending??0;if(e.disbursementStatus==="Ongoing"&&r>0){let i=n.thresholds.Invested;o>=i&&s.push({...a,reason:"disbursement_outstanding",detail:`Disbursement ongoing with ${r.toLocaleString()} still pending, no touch in ${o} days.`,idleDays:o,thresholdDays:i})}}else{let r=n.thresholds[e.engagementStage];r!==void 0&&o>=r&&s.push({...a,reason:"stalled",detail:`No touch in ${o} days at stage ${e.engagementStage} (threshold ${r}d).`,idleDays:o,thresholdDays:r})}return e.termSheetIssued&&!e.termSheetDate&&s.push({...a,reason:"term_sheet_undated",detail:"Term sheet is marked issued but has no date recorded.",idleDays:o,thresholdDays:null}),s}async function k(e,t={}){let n=e.now?e.now():new Date,s=await e.crm.query(_),a={thresholds:e.thresholds,now:n,baseUrl:e.crm.baseUrl},o=[];for(let r of s.engagementsByDeal)if(!(t.transactionId&&r.transaction.id!==t.transactionId))for(let i of r.engagements)t.investorId&&i.investor.id!==t.investorId||o.push(...G(i,r.transaction,a));return o.sort((r,i)=>i.idleDays-r.idleDays)}var K=S.z.object({deal:S.z.string().optional().describe("Limit the scan to one transaction/deal (name or exact id)"),investor:S.z.string().optional().describe("Limit the scan to one investor (name or exact id)")}),g=class{constructor(t){this.deps=t}deps;name="scan_stalled_engagements";description="Scan investor-deal engagements on live deals for stalled or overdue items: idle beyond the per-stage threshold, disbursements still outstanding, or issued term sheets missing their date. Read-only \u2014 offer create_followup_task for any flag the deal lead wants actioned.";inputSchema=K;async execute(t){let n=this.deps?.crm??I(),s=this.deps?.thresholds??C(),a={};for(let[r,i,d]of[["deal","transaction","transactionId"],["investor","investor","investorId"]]){let l=t[r];if(!l)continue;let p=await R(n,i,l);if(p.kind==="none")return{status:"not_found",message:`No ${i} matching "${l}" was found.`};if(p.kind==="ambiguous")return{status:"ambiguous",message:`Multiple ${i}s match "${l}" \u2014 ask the user to pick one, then call again with the chosen id.`,candidates:p.candidates.map(y=>({id:y.id,title:y.title,subtitle:y.subtitle??null}))};a[d]=p.result.id}let o=await k({crm:n,thresholds:s,now:this.deps?.now},a);return{status:"ok",flagged:o.length,flags:o.map(r=>({investor:r.investor.name,deal:r.transaction.name,stage:r.stage,reason:r.reason,detail:r.detail,idleDays:Number.isFinite(r.idleDays)?r.idleDays:null,engagementId:r.engagementId,link:r.link}))}}};var u=new g,j={version:"2.0.0",kind:"tool",name:"scan_stalled_engagements",description:"Scan investor-deal engagements on live deals for stalled or overdue items: idle beyond the per-stage threshold, disbursements still outstanding, or issued term sheets missing their date. Read-only \u2014 offer create_followup_task for any flag the deal lead wants actioned.",exportName:"ScanStalledEngagementsTool",pattern:"class-definition"},z={__lua_primitive__:j,primitive:{kind:"tool",name:u.name??"scan_stalled_engagements",description:u.description??"Scan investor-deal engagements on live deals for stalled or overdue items: idle beyond the per-stage threshold, disbursements still outstanding, or issued term sheets missing their date. Read-only \u2014 offer create_followup_task for any flag the deal lead wants actioned.",inputSchema:u.inputSchema,execute:typeof u.execute=="function"?u.execute.bind(u):void 0,condition:typeof u.condition=="function"?u.condition.bind(u):void 0}};0&&(module.exports={ScanStalledEngagementsTool});
