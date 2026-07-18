var A=Object.defineProperty;var x=Object.getOwnPropertyDescriptor;var D=Object.getOwnPropertyNames;var P=Object.prototype.hasOwnProperty;var N=(n,t)=>{for(var a in t)A(n,a,{get:t[a],enumerable:!0})},F=(n,t,a,s)=>{if(t&&typeof t=="object"||typeof t=="function")for(let r of D(t))!P.call(n,r)&&r!==a&&A(n,r,{get:()=>t[r],enumerable:!(s=x(t,r))||s.enumerable});return n};var k=n=>F(A({},"__esModule",{value:!0}),n);var O={};N(O,{PartnerPerformanceTool:()=>f,default:()=>U});module.exports=k(O);var T=require("zod");var g="The CRM didn't respond \u2014 please try again in a minute.",l=class extends Error{constructor(t,a){super(t),this.name="CrmError",this.detail=a}};function w(n){let{apiUrl:t,agentKey:a}=n,s=n.fetchFn??fetch;return{baseUrl:t.replace(/\/api\/graphql\/?$/,""),async query(e,i){let o;try{o=await s(t,{method:"POST",headers:{"content-type":"application/json","x-agent-key":a},body:JSON.stringify({query:e,variables:i})})}catch(c){throw new l(g,c instanceof Error?c.message:String(c))}if(!o.ok)throw new l(g,`HTTP ${o.status}`);let d;try{d=await o.json()}catch(c){throw new l(g,`invalid JSON response: ${c instanceof Error?c.message:String(c)}`)}if(d.errors?.length)throw new l(`The CRM rejected the request: ${d.errors.map(c=>c.message).join("; ")}`);if(d.data===void 0||d.data===null)throw new l(g,"empty data");return d.data}}}function S(){let n=env("CRM_API_URL"),t=env("CRM_AGENT_KEY");if(!n)throw new l("Agent misconfigured: CRM_API_URL is not set.");if(!t)throw new l("Agent misconfigured: CRM_AGENT_KEY is not set.");return w({apiUrl:n,agentKey:t})}var I=`
  query AgentGlobalSearch($query: String!, $limit: Int) {
    globalSearch(query: $query, limit: $limit) { id type title subtitle href }
  }
`,p="activities { type subject body occurredAt channel direction }",R="stageChanges { field fromValue toValue changedAt createdSource changedBy { name } }",m="feeSharingAgreement feeSharingTerms partnerAgreementStatus internalOnly",G={client:{rootField:"client",document:`
      query AgentClient($id: ID!) {
        client(id: $id) {
          id name sector status hqCity hqCountry website description
          revenueLastYear revenueForecast currency profitability existingInvestors staffCount
          createdAt updatedAt
          contacts { firstName lastName email jobTitle isPrimaryContact }
          mandates { id name stage dealSize currency nextAction stageEnteredAt }
          transactions { id name stage targetRaise currency dealStatus stageEnteredAt }
          ${p}
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
          ${p}
        }
      }
    `},mandate:{rootField:"mandate",document:`
      query AgentMandate($id: ID!) {
        mandate(id: $id) {
          id name stage stageEnteredAt daysInStage dealStatus dealSize currency sector source
          dateOpened ndaStatus ndaSignedDate eaStatus eaSignedDate nextAction notes
          retainerAmount priority createdAt updatedAt leadId
          client { id name }
          referredBy { id name }
          transactions { id name stage }
          ${p}
        }
      }
    `},transaction:{rootField:"transaction",document:`
      query AgentTransaction($id: ID!) {
        transaction(id: $id) {
          id name stage stageEnteredAt dealType instrument targetRaise currency sector
          dateOpened closedAt dealStatus dealMilestone financingType probability notes priority
          partnerFeeStatus partnerFeeAmount activeConversations createdAt updatedAt ownerId
          client { id name }
          mandate { id name stage }
          referredBy { id name }
          ${p}
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
          ${p}
        }
      }
    `},partner:{rootField:"partner",document:`
      query AgentPartner($id: ID!) {
        partner(id: $id) {
          id name partnerType status location organization email phone profile
          ${m} feedbackNotes
          createdAt updatedAt
          contacts { firstName lastName email }
          referredMandates { id name stage }
          referredTransactions { id name stage }
        }
      }
    `}};var _=`
  query ReferralPartnerById($id: ID!) {
    partner(id: $id) { id name }
  }
`,$=`
  query ReferralMandateById($id: ID!) {
    mandate(id: $id) { id name }
  }
`,h=`
  query ReferralClientById($id: ID!) {
    client(id: $id) { id name }
  }
`,E=`
  query ReferralTransactionById($id: ID!) {
    transaction(id: $id) { id name }
  }
`,j=`
  query ReferralPartnerDetail($id: ID!) {
    partner(id: $id) {
      id name partnerType status location organization email phone profile
      ${m} feedbackNotes
      createdAt updatedAt
      contacts { firstName lastName email jobTitle isPrimaryContact }
      referredMandates {
        id name stage dealStatus dealSize currency stageEnteredAt updatedAt
        client { id name }
        transactions { id name stage dealStatus targetRaise currency partnerFeeStatus partnerFeeAmount }
      }
      referredTransactions {
        id name stage dealStatus targetRaise currency partnerFeeStatus partnerFeeAmount
        mandateId
        client { id name }
      }
      ${R}
    }
  }
`,K=`
  query ReferralMandateStatus($id: ID!) {
    mandate(id: $id) {
      id name stage stageEnteredAt daysInStage dealStatus dealSize currency
      dateOpened createdAt updatedAt clientId
      client { id name }
      referredBy { id name partnerType status ${m} }
      transactions { id name stage dealStatus targetRaise currency partnerFeeStatus partnerFeeAmount }
      ${R}
    }
  }
`,H=`
  query ReferralTransactionStatus($id: ID!) {
    transaction(id: $id) {
      id name stage stageEnteredAt dealStatus targetRaise currency
      partnerFeeStatus partnerFeeAmount
      dateOpened closedAt createdAt updatedAt clientId
      client { id name }
      referredBy { id name partnerType status ${m} }
      mandate {
        id name stage
        referredBy { id name partnerType status ${m} }
      }
      ${R}
    }
  }
`;var v=`
  query ReferralPartnerStats {
    partnerReferralStats {
      totalPartners dealsReferred closedRevenue conversionRate
      byPartner { id name referred active closed revenue }
    }
  }
`,V=`
  mutation ReferralCreatePartner($input: PartnerInput!) {
    createPartner(input: $input) {
      id name partnerType status organization email phone
      ${m} updatedAt
    }
  }
`,J=`
  mutation ReferralUpdatePartner($id: ID!, $input: PartnerInput!) {
    updatePartner(id: $id, input: $input) {
      id name partnerType status organization email phone
      ${m} feedbackNotes updatedAt
    }
  }
`;var y={client:"Client",investor:"Investor",mandate:"Mandate",transaction:"Transaction",engagement:"Engagement",partner:"Partner"};function b(n,t,a){let s=y[t],r=n.filter(d=>d.type===s);if(r.length===0)return{kind:"none"};let e=r.find(d=>d.id===a);if(e)return{kind:"match",result:e};let i=a.trim().toLowerCase(),o=r.filter(d=>d.title.trim().toLowerCase()===i);return o.length===1?{kind:"match",result:o[0]}:r.length===1?{kind:"match",result:r[0]}:{kind:"ambiguous",candidates:r.slice(0,5)}}var M={partner:{document:_,rootField:"partner",hrefPrefix:"/partners"},mandate:{document:$,rootField:"mandate",hrefPrefix:"/mandates"},client:{document:h,rootField:"client",hrefPrefix:"/clients"},transaction:{document:E,rootField:"transaction",hrefPrefix:"/transactions"}};function L(n){return/^c[a-z0-9]{20,32}$/i.test(n.trim())}async function C(n,t,a){let s=await n.query(I,{query:a,limit:10}),r=b(s.globalSearch,t,a);if(r.kind!=="none"||!L(a))return r;let e=M[t];if(!e)return r;try{let o=(await n.query(e.document,{id:a.trim()}))[e.rootField];if(o)return{kind:"match",result:{id:o.id,type:y[t],title:o.name,subtitle:null,href:`${e.hrefPrefix}/${o.id}`}}}catch{}return r}var q=T.z.object({partner:T.z.string().optional().describe("Narrow to one partner \u2014 name as the user said it, or an exact id; omit for the firm-wide leaderboard")}),f=class{constructor(t){this.deps=t}deps;name="partner_performance";description="Referral performance rollup: deals referred, still active, closed, revenue and conversion \u2014 firm-wide leaderboard across all partners, or one partner's numbers. Read-only.";inputSchema=q;async execute(t){let a=this.deps?.crm??S(),s;if(t.partner){let e=await C(a,"partner",t.partner);if(e.kind==="none")return{status:"not_found",message:`No partner matching "${t.partner}" was found in the CRM.`};if(e.kind==="ambiguous")return{status:"ambiguous",message:"Multiple partners match \u2014 ask the user to pick one, then call again with the chosen id.",candidates:e.candidates.map(i=>({id:i.id,title:i.title,subtitle:i.subtitle??null}))};s=e.result.id}let r=(await a.query(v)).partnerReferralStats;if(s){let e=r.byPartner.find(i=>i.id===s);return e?{status:"ok",partner:{id:e.id,name:e.name,referred:e.referred,active:e.active,closed:e.closed,revenue:e.revenue,conversionRate:e.referred>0?e.closed/e.referred:0},link:`${a.baseUrl}/partners/${e.id}`}:{status:"not_found",message:"The partner could not be loaded from the CRM stats."}}return{status:"ok",totals:{totalPartners:r.totalPartners,dealsReferred:r.dealsReferred,closedRevenue:r.closedRevenue,conversionRate:r.conversionRate},leaderboard:[...r.byPartner].sort((e,i)=>i.revenue-e.revenue||i.closed-e.closed||i.referred-e.referred).map(e=>({name:e.name,referred:e.referred,active:e.active,closed:e.closed,revenue:e.revenue,link:`${a.baseUrl}/partners/${e.id}`})),link:`${a.baseUrl}/partners`}}};var u=new f,B={version:"2.0.0",kind:"tool",name:"partner_performance",description:"Referral performance rollup: deals referred, still active, closed, revenue and conversion \u2014 firm-wide leaderboard across all partners, or one partner's numbers. Read-only.",exportName:"PartnerPerformanceTool",pattern:"class-definition"},U={__lua_primitive__:B,primitive:{kind:"tool",name:u.name??"partner_performance",description:u.description??"Referral performance rollup: deals referred, still active, closed, revenue and conversion \u2014 firm-wide leaderboard across all partners, or one partner's numbers. Read-only.",inputSchema:u.inputSchema,execute:typeof u.execute=="function"?u.execute.bind(u):void 0,condition:typeof u.condition=="function"?u.condition.bind(u):void 0}};0&&(module.exports={PartnerPerformanceTool});
