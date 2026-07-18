var h=Object.defineProperty;var C=Object.getOwnPropertyDescriptor;var k=Object.getOwnPropertyNames;var $=Object.prototype.hasOwnProperty;var b=(n,t)=>{for(var a in t)h(n,a,{get:t[a],enumerable:!0})},D=(n,t,a,r)=>{if(t&&typeof t=="object"||typeof t=="function")for(let i of k(t))!$.call(n,i)&&i!==a&&h(n,i,{get:()=>t[i],enumerable:!(r=C(t,i))||r.enumerable});return n};var x=n=>D(h({},"__esModule",{value:!0}),n);var q={};b(q,{FindFitInvestorsTool:()=>g,default:()=>L});module.exports=x(q);var A=require("zod");var p="The CRM didn't respond \u2014 please try again in a minute.",c=class extends Error{constructor(t,a){super(t),this.name="CrmError",this.detail=a}};function w(n){let{apiUrl:t,agentKey:a}=n,r=n.fetchFn??fetch;return{baseUrl:t.replace(/\/api\/graphql\/?$/,""),async query(d,u){let o;try{o=await r(t,{method:"POST",headers:{"content-type":"application/json","x-agent-key":a},body:JSON.stringify({query:d,variables:u})})}catch(e){throw new c(p,e instanceof Error?e.message:String(e))}if(!o.ok)throw new c(p,`HTTP ${o.status}`);let s;try{s=await o.json()}catch(e){throw new c(p,`invalid JSON response: ${e instanceof Error?e.message:String(e)}`)}if(s.errors?.length)throw new c(`The CRM rejected the request: ${s.errors.map(e=>e.message).join("; ")}`);if(s.data===void 0||s.data===null)throw new c(p,"empty data");return s.data}}}function f(){let n=env("CRM_API_URL"),t=env("CRM_AGENT_KEY");if(!n)throw new c("Agent misconfigured: CRM_API_URL is not set.");if(!t)throw new c("Agent misconfigured: CRM_AGENT_KEY is not set.");return w({apiUrl:n,agentKey:t})}var I=`
  query AgentGlobalSearch($query: String!, $limit: Int) {
    globalSearch(query: $query, limit: $limit) { id type title subtitle href }
  }
`,m="activities { type subject body occurredAt channel direction }",S={client:{rootField:"client",document:`
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
`;var T=`
  query TrackerTransactionById($id: ID!) {
    transaction(id: $id) { id name }
  }
`,v=`
  query TrackerInvestorById($id: ID!) {
    investor(id: $id) { id name }
  }
`;var R=`
  query TrackerMatchInvestors($transactionId: ID!) {
    aiMatchInvestors(transactionId: $transactionId) {
      id name score reasons warnings contactName criteriaStale
    }
  }
`;var y={client:"Client",investor:"Investor",mandate:"Mandate",transaction:"Transaction",engagement:"Engagement",partner:"Partner"};function _(n,t,a){let r=y[t],i=n.filter(s=>s.type===r);if(i.length===0)return{kind:"none"};let d=i.find(s=>s.id===a);if(d)return{kind:"match",result:d};let u=a.trim().toLowerCase(),o=i.filter(s=>s.title.trim().toLowerCase()===u);return o.length===1?{kind:"match",result:o[0]}:i.length===1?{kind:"match",result:i[0]}:{kind:"ambiguous",candidates:i.slice(0,5)}}var N={transaction:{document:T,rootField:"transaction",hrefPrefix:"/transactions"},investor:{document:v,rootField:"investor",hrefPrefix:"/investors"}};function M(n){return/^c[a-z0-9]{20,32}$/i.test(n.trim())}async function E(n,t,a){let r=await n.query(I,{query:a,limit:10}),i=_(r.globalSearch,t,a);if(i.kind!=="none"||!M(a))return i;let d=N[t];if(!d)return i;try{let o=(await n.query(d.document,{id:a.trim()}))[d.rootField];if(o)return{kind:"match",result:{id:o.id,type:y[t],title:o.name,subtitle:null,href:`${d.hrefPrefix}/${o.id}`}}}catch{}return i}var P=A.z.object({deal:A.z.string().min(1).describe("The live transaction/deal to match investors against \u2014 name as the user said it, or an exact id")}),g=class{constructor(t){this.deps=t}deps;name="find_fit_investors";description="Rank which investors fit a live deal (mandate criteria match: sector, geography, ticket size, instrument). Returns up to 8 matches with reasons and warnings, and notes which already have an engagement on this deal. Excluded and greylisted investors are never returned. Read-only \u2014 introducing an investor to the deal is a human decision.";inputSchema=P;async execute(t){let a=this.deps?.crm??f(),r=await E(a,"transaction",t.deal);if(r.kind==="none")return{status:"not_found",message:`No deal matching "${t.deal}" was found in the CRM.`};if(r.kind==="ambiguous")return{status:"ambiguous",message:"Multiple deals match \u2014 ask the user to pick one, then call again with the chosen id.",candidates:r.candidates.map(e=>({id:e.id,title:e.title,subtitle:e.subtitle??null}))};let[i,d]=await Promise.all([a.query(R,{transactionId:r.result.id}),a.query(S.transaction.document,{id:r.result.id})]),u=new Set((d.transaction?.engagements??[]).filter(e=>e.investor.engagementClassification==="Excluded"||e.investor.engagementClassification==="Greylisted").map(e=>e.investor.id)),o=new Set((d.transaction?.engagements??[]).map(e=>e.investor.id)),s=i.aiMatchInvestors.filter(e=>!u.has(e.id)).map(e=>({name:e.name,id:e.id,score:e.score,reasons:e.reasons,warnings:e.warnings,contactName:e.contactName??null,criteriaStale:e.criteriaStale,alreadyEngagedOnThisDeal:o.has(e.id)}));return{status:"ok",deal:r.result.title,matches:s,link:`${a.baseUrl}${r.result.href}`,note:s.length===0?"No active, approved investors currently fit this deal's criteria.":void 0}}};var l=new g,O={version:"2.0.0",kind:"tool",name:"find_fit_investors",description:"Rank which investors fit a live deal (mandate criteria match: sector, geography, ticket size, instrument). Returns up to 8 matches with reasons and warnings, and notes which already have an engagement on this deal. Excluded and greylisted investors are never returned. Read-only \u2014 introducing an investor to the deal is a human decision.",exportName:"FindFitInvestorsTool",pattern:"class-definition"},L={__lua_primitive__:O,primitive:{kind:"tool",name:l.name??"find_fit_investors",description:l.description??"Rank which investors fit a live deal (mandate criteria match: sector, geography, ticket size, instrument). Returns up to 8 matches with reasons and warnings, and notes which already have an engagement on this deal. Excluded and greylisted investors are never returned. Read-only \u2014 introducing an investor to the deal is a human decision.",inputSchema:l.inputSchema,execute:typeof l.execute=="function"?l.execute.bind(l):void 0,condition:typeof l.condition=="function"?l.condition.bind(l):void 0}};0&&(module.exports={FindFitInvestorsTool});
