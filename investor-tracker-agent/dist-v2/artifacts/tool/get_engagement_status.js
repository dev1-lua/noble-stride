var S=Object.defineProperty;var w=Object.getOwnPropertyDescriptor;var P=Object.getOwnPropertyNames;var M=Object.prototype.hasOwnProperty;var O=(n,t)=>{for(var i in t)S(n,i,{get:t[i],enumerable:!0})},L=(n,t,i,r)=>{if(t&&typeof t=="object"||typeof t=="function")for(let a of P(t))!M.call(n,a)&&a!==i&&S(n,a,{get:()=>t[a],enumerable:!(r=w(t,a))||r.enumerable});return n};var F=n=>L(S({},"__esModule",{value:!0}),n);var H={};O(H,{GetEngagementStatusTool:()=>h,default:()=>z});module.exports=F(H);var y=require("zod");var f="The CRM didn't respond \u2014 please try again in a minute.",u=class extends Error{constructor(t,i){super(t),this.name="CrmError",this.detail=i}};function q(n){let{apiUrl:t,agentKey:i}=n,r=n.fetchFn??fetch;return{baseUrl:t.replace(/\/api\/graphql\/?$/,""),async query(l,e){let s;try{s=await r(t,{method:"POST",headers:{"content-type":"application/json","x-agent-key":i},body:JSON.stringify({query:l,variables:e})})}catch(d){throw new u(f,d instanceof Error?d.message:String(d))}if(!s.ok)throw new u(f,`HTTP ${s.status}`);let o;try{o=await s.json()}catch(d){throw new u(f,`invalid JSON response: ${d instanceof Error?d.message:String(d)}`)}if(o.errors?.length)throw new u(`The CRM rejected the request: ${o.errors.map(d=>d.message).join("; ")}`);if(o.data===void 0||o.data===null)throw new u(f,"empty data");return o.data}}}function I(){let n=env("CRM_API_URL"),t=env("CRM_AGENT_KEY");if(!n)throw new u("Agent misconfigured: CRM_API_URL is not set.");if(!t)throw new u("Agent misconfigured: CRM_AGENT_KEY is not set.");return q({apiUrl:n,agentKey:t})}var k=`
  query AgentGlobalSearch($query: String!, $limit: Int) {
    globalSearch(query: $query, limit: $limit) { id type title subtitle href }
  }
`,m="activities { type subject body occurredAt channel direction }",_={client:{rootField:"client",document:`
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
    `}};var b=`
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
`;var R=`
  query TrackerTransactionById($id: ID!) {
    transaction(id: $id) { id name }
  }
`,E=`
  query TrackerInvestorById($id: ID!) {
    investor(id: $id) { id name }
  }
`;var A={client:"Client",investor:"Investor",mandate:"Mandate",transaction:"Transaction",engagement:"Engagement",partner:"Partner"};function D(n,t,i){let r=A[t],a=n.filter(o=>o.type===r);if(a.length===0)return{kind:"none"};let l=a.find(o=>o.id===i);if(l)return{kind:"match",result:l};let e=i.trim().toLowerCase(),s=a.filter(o=>o.title.trim().toLowerCase()===e);return s.length===1?{kind:"match",result:s[0]}:a.length===1?{kind:"match",result:a[0]}:{kind:"ambiguous",candidates:a.slice(0,5)}}var U={transaction:{document:R,rootField:"transaction",hrefPrefix:"/transactions"},investor:{document:E,rootField:"investor",hrefPrefix:"/investors"}};function Y(n){return/^c[a-z0-9]{20,32}$/i.test(n.trim())}async function v(n,t,i){let r=await n.query(k,{query:i,limit:10}),a=D(r.globalSearch,t,i);if(a.kind!=="none"||!Y(i))return a;let l=U[t];if(!l)return a;try{let s=(await n.query(l.document,{id:i.trim()}))[l.rootField];if(s)return{kind:"match",result:{id:s.id,type:A[t],title:s.name,subtitle:null,href:`${l.hrefPrefix}/${s.id}`}}}catch{}return a}async function x(n,t,i){let[r,a]=await Promise.all([v(n,"investor",t),v(n,"transaction",i)]);if(r.kind==="none")return{kind:"investor_not_found"};if(r.kind==="ambiguous")return{kind:"ambiguous_investor",candidates:C(r.candidates)};if(a.kind==="none")return{kind:"deal_not_found"};if(a.kind==="ambiguous")return{kind:"ambiguous_deal",candidates:C(a.candidates)};let e=(await n.query(_.transaction.document,{id:a.result.id})).transaction;if(!e)return{kind:"deal_not_found"};let s={id:r.result.id,name:r.result.title},o={id:e.id,name:e.name},d=e.engagements.find(p=>p.investor.id===s.id);return d?{kind:"ok",engagementId:d.id,investor:s,transaction:o}:{kind:"no_engagement",investor:s,transaction:o}}function C(n){return n.map(t=>({id:t.id,title:t.title,subtitle:t.subtitle??null}))}var T={Shared:14,TeaserSent:10,NDASigned:14,IMShared:14,VDRAccess:21,Meeting:10,InfoRequest:7,DueDiligence:21,TermSheet:14,Offer:7,Invested:30};function G(n){if(!n)return T;try{let t=JSON.parse(n),i={...T};for(let[r,a]of Object.entries(t))r in i&&typeof a=="number"&&a>0&&(i[r]=a);return i}catch{return console.warn("TRACKER_STALE_DAYS is not valid JSON \u2014 using default thresholds."),T}}function $(){return G(env("TRACKER_STALE_DAYS"))}var B=1440*60*1e3;function N(n,t){let i=[t.lastContact,t.updatedAt].filter(r=>!!r).map(r=>new Date(r).getTime()).filter(r=>Number.isFinite(r));return i.length===0?Number.POSITIVE_INFINITY:Math.floor((n.getTime()-Math.max(...i))/B)}var K=y.z.object({investor:y.z.string().optional().describe("Investor name as the user said it, or an exact id from a previous candidates list"),deal:y.z.string().optional().describe("Transaction/deal name as the user said it, or an exact id from a previous candidates list"),engagementId:y.z.string().optional().describe("Skip name resolution when a previous call already returned the engagement id")}),h=class{constructor(t){this.deps=t}deps;name="get_engagement_status";description="Full tracking picture of ONE investor's engagement on ONE deal: stage, NDA, term sheet, amounts and disbursement, the milestone checklist, the deal's due-diligence tracks, recent activity, a staleness verdict, and a deep link. Identify the engagement either by engagementId (from a previous call) or by investor + deal names.";inputSchema=K;getDeps(){return this.deps??{crm:I()}}async execute(t){let i=this.getDeps(),{crm:r}=i,a=t.engagementId;if(!a){if(!t.investor||!t.deal)return{status:"rejected",message:"Provide either engagementId, or both investor and deal names."};let c=await x(r,t.investor,t.deal);if(c.kind!=="ok")return c.kind==="no_engagement"?{status:"no_engagement",message:`${c.investor.name} has no engagement on ${c.transaction.name}. Starting a new investor-deal engagement is outside this agent's scope (that's investor outreach).`}:c.kind==="ambiguous_investor"||c.kind==="ambiguous_deal"?{status:c.kind,message:"Multiple records match \u2014 ask the user to pick one, then call again with the chosen id.",candidates:c.candidates}:{status:c.kind,message:"No matching record was found in the CRM."};a=c.engagementId}let e=(await r.query(b,{id:a})).engagement;if(!e)return{status:"not_found",message:"The engagement could not be loaded from the CRM."};let s=i.thresholds??$(),o=i.now?i.now():new Date,d=N(o,e),p=e.engagementStage==="Declined"?null:s[e.engagementStage]??null;return{status:"ok",engagement:{id:e.id,name:e.name,stage:e.engagementStage,coarseStatus:e.status,interestLevel:e.interestLevel??null,nda:{type:e.ndaType??null,signedAt:e.ndaSignedAt??null,investorNdaStatus:e.investor.ndaStatus??null},termSheet:{issued:e.termSheetIssued,date:e.termSheetDate??null},amounts:{total:e.totalAmount??null,disbursed:e.amountDisbursed??null,pending:e.amountPending??null,disbursementStatus:e.disbursementStatus??null,dateReceived:e.dateReceived??null},probability:e.probability??null,feedback:e.feedback??null,notes:e.notes??null,investor:{id:e.investor.id,name:e.investor.name,type:e.investor.investorType??null,classification:e.investor.engagementClassification??null},deal:{id:e.transaction.id,name:e.transaction.name,stage:e.transaction.stage,dealStatus:e.transaction.dealStatus,client:e.transaction.client?.name??null},milestones:e.milestones,ddTracks:e.transaction.ddTracks,recentActivities:e.activities.slice(0,10),staleness:{idleDays:Number.isFinite(d)?d:null,thresholdDays:p,isStale:p!==null&&d>=p}},link:`${r.baseUrl}/engagement/${e.id}`}}};var g=new h,j={version:"2.0.0",kind:"tool",name:"get_engagement_status",description:"Full tracking picture of ONE investor's engagement on ONE deal: stage, NDA, term sheet, amounts and disbursement, the milestone checklist, the deal's due-diligence tracks, recent activity, a staleness verdict, and a deep link. Identify the engagement either by engagementId (from a previous call) or by investor + deal names.",exportName:"GetEngagementStatusTool",pattern:"class-definition"},z={__lua_primitive__:j,primitive:{kind:"tool",name:g.name??"get_engagement_status",description:g.description??"Full tracking picture of ONE investor's engagement on ONE deal: stage, NDA, term sheet, amounts and disbursement, the milestone checklist, the deal's due-diligence tracks, recent activity, a staleness verdict, and a deep link. Identify the engagement either by engagementId (from a previous call) or by investor + deal names.",inputSchema:g.inputSchema,execute:typeof g.execute=="function"?g.execute.bind(g):void 0,condition:typeof g.condition=="function"?g.condition.bind(g):void 0}};0&&(module.exports={GetEngagementStatusTool});
