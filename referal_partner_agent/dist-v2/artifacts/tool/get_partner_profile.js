var A=Object.defineProperty;var D=Object.getOwnPropertyDescriptor;var N=Object.getOwnPropertyNames;var P=Object.prototype.hasOwnProperty;var k=(r,n)=>{for(var a in n)A(r,a,{get:n[a],enumerable:!0})},w=(r,n,a,o)=>{if(n&&typeof n=="object"||typeof n=="function")for(let i of N(n))!P.call(r,i)&&i!==a&&A(r,i,{get:()=>n[i],enumerable:!(o=D(n,i))||o.enumerable});return r};var M=r=>w(A({},"__esModule",{value:!0}),r);var Y={};k(Y,{GetPartnerProfileTool:()=>f,default:()=>z});module.exports=M(Y);var R=require("zod");var y="The CRM didn't respond \u2014 please try again in a minute.",c=class extends Error{constructor(n,a){super(n),this.name="CrmError",this.detail=a}};function L(r){let{apiUrl:n,agentKey:a}=r,o=r.fetchFn??fetch;return{baseUrl:n.replace(/\/api\/graphql\/?$/,""),async query(t,g){let s;try{s=await o(n,{method:"POST",headers:{"content-type":"application/json","x-agent-key":a},body:JSON.stringify({query:t,variables:g})})}catch(l){throw new c(y,l instanceof Error?l.message:String(l))}if(!s.ok)throw new c(y,`HTTP ${s.status}`);let d;try{d=await s.json()}catch(l){throw new c(y,`invalid JSON response: ${l instanceof Error?l.message:String(l)}`)}if(d.errors?.length)throw new c(`The CRM rejected the request: ${d.errors.map(l=>l.message).join("; ")}`);if(d.data===void 0||d.data===null)throw new c(y,"empty data");return d.data}}}function T(){let r=env("CRM_API_URL"),n=env("CRM_AGENT_KEY");if(!r)throw new c("Agent misconfigured: CRM_API_URL is not set.");if(!n)throw new c("Agent misconfigured: CRM_AGENT_KEY is not set.");return L({apiUrl:r,agentKey:n})}var I=`
  query AgentGlobalSearch($query: String!, $limit: Int) {
    globalSearch(query: $query, limit: $limit) { id type title subtitle href }
  }
`,p="activities { type subject body occurredAt channel direction }",h="stageChanges { field fromValue toValue changedAt createdSource changedBy { name } }",m="feeSharingAgreement feeSharingTerms partnerAgreementStatus internalOnly",V={client:{rootField:"client",document:`
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
`,E=`
  query ReferralClientById($id: ID!) {
    client(id: $id) { id name }
  }
`,b=`
  query ReferralTransactionById($id: ID!) {
    transaction(id: $id) { id name }
  }
`,C=`
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
      ${h}
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
      ${h}
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
      ${h}
    }
  }
`;var W=`
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
`;var S={client:"Client",investor:"Investor",mandate:"Mandate",transaction:"Transaction",engagement:"Engagement",partner:"Partner"};function F(r,n,a){let o=S[n],i=r.filter(d=>d.type===o);if(i.length===0)return{kind:"none"};let t=i.find(d=>d.id===a);if(t)return{kind:"match",result:t};let g=a.trim().toLowerCase(),s=i.filter(d=>d.title.trim().toLowerCase()===g);return s.length===1?{kind:"match",result:s[0]}:i.length===1?{kind:"match",result:i[0]}:{kind:"ambiguous",candidates:i.slice(0,5)}}var O={partner:{document:_,rootField:"partner",hrefPrefix:"/partners"},mandate:{document:$,rootField:"mandate",hrefPrefix:"/mandates"},client:{document:E,rootField:"client",hrefPrefix:"/clients"},transaction:{document:b,rootField:"transaction",hrefPrefix:"/transactions"}};function q(r){return/^c[a-z0-9]{20,32}$/i.test(r.trim())}async function v(r,n,a){let o=await r.query(I,{query:a,limit:10}),i=F(o.globalSearch,n,a);if(i.kind!=="none"||!q(a))return i;let t=O[n];if(!t)return i;try{let s=(await r.query(t.document,{id:a.trim()}))[t.rootField];if(s)return{kind:"match",result:{id:s.id,type:S[n],title:s.name,subtitle:null,href:`${t.hrefPrefix}/${s.id}`}}}catch{}return i}function x(r){return r.feeSharingAgreement===!0&&r.partnerAgreementStatus==="Signed"}var B=R.z.object({partner:R.z.string().min(1).describe("Partner name as the user said it, or an exact id from a previous candidates list")}),f=class{constructor(n){this.deps=n}deps;name="get_partner_profile";description="Full referral profile of ONE partner: contact details, fee-sharing agreement state, every deal they introduced (mandates and transactions, with stages and conversion), fee statuses, change history, and a deep link. Identify the partner by name or by an exact id from a previous candidates list.";inputSchema=B;async execute(n){let a=this.deps?.crm??T(),o=await v(a,"partner",n.partner);if(o.kind==="none")return{status:"not_found",message:`No partner matching "${n.partner}" was found in the CRM.`};if(o.kind==="ambiguous")return{status:"ambiguous",message:"Multiple partners match \u2014 ask the user to pick one, then call again with the chosen id.",candidates:o.candidates.map(e=>({id:e.id,title:e.title,subtitle:e.subtitle??null}))};let t=(await a.query(C,{id:o.result.id})).partner;if(!t)return{status:"not_found",message:"The partner could not be loaded from the CRM."};let g=new Set(t.referredMandates.map(e=>e.id)),s=t.referredTransactions.filter(e=>e.mandateId==null||!g.has(e.mandateId)),d=t.referredMandates.filter(e=>e.stage==="Signed").length,l=s.filter(e=>e.stage==="ClosedWon").length;return{status:"ok",partner:{id:t.id,name:t.name,type:t.partnerType??null,status:t.status,location:t.location??null,organization:t.organization??null,email:t.email??null,phone:t.phone??null,profile:t.profile??null,internalOnly:t.internalOnly,feedbackNotes:t.feedbackNotes??null,contacts:t.contacts,agreement:{feeSharingAgreement:t.feeSharingAgreement,status:t.partnerAgreementStatus,terms:t.feeSharingTerms??null,recorded:x(t)}},referrals:{mandates:t.referredMandates.map(e=>({id:e.id,name:e.name,client:e.client?.name??null,stage:e.stage,dealStatus:e.dealStatus,dealSize:e.dealSize??null,currency:e.currency??null,converted:e.stage==="Signed",lost:e.stage==="Lost",transactions:e.transactions,link:`${a.baseUrl}/mandates/${e.id}`})),directTransactions:s.map(e=>({id:e.id,name:e.name,client:e.client?.name??null,stage:e.stage,dealStatus:e.dealStatus,targetRaise:e.targetRaise??null,currency:e.currency??null,converted:e.stage==="ClosedWon",lost:e.stage==="ClosedLost",fee:{status:e.partnerFeeStatus??null,amount:e.partnerFeeAmount??null},link:`${a.baseUrl}/transactions/${e.id}`})),totals:{referred:t.referredMandates.length+s.length,converted:d+l}},history:t.stageChanges.slice(0,20),link:`${a.baseUrl}/partners/${t.id}`}}};var u=new f,U={version:"2.0.0",kind:"tool",name:"get_partner_profile",description:"Full referral profile of ONE partner: contact details, fee-sharing agreement state, every deal they introduced (mandates and transactions, with stages and conversion), fee statuses, change history, and a deep link. Identify the partner by name or by an exact id from a previous candidates list.",exportName:"GetPartnerProfileTool",pattern:"class-definition"},z={__lua_primitive__:U,primitive:{kind:"tool",name:u.name??"get_partner_profile",description:u.description??"Full referral profile of ONE partner: contact details, fee-sharing agreement state, every deal they introduced (mandates and transactions, with stages and conversion), fee statuses, change history, and a deep link. Identify the partner by name or by an exact id from a previous candidates list.",inputSchema:u.inputSchema,execute:typeof u.execute=="function"?u.execute.bind(u):void 0,condition:typeof u.condition=="function"?u.condition.bind(u):void 0}};0&&(module.exports={GetPartnerProfileTool});
