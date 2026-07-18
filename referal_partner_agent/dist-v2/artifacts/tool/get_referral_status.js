var R=Object.defineProperty;var L=Object.getOwnPropertyDescriptor;var O=Object.getOwnPropertyNames;var B=Object.prototype.hasOwnProperty;var q=(e,t)=>{for(var a in t)R(e,a,{get:t[a],enumerable:!0})},U=(e,t,a,c)=>{if(t&&typeof t=="object"||typeof t=="function")for(let r of O(t))!B.call(e,r)&&r!==a&&R(e,r,{get:()=>t[r],enumerable:!(c=L(t,r))||c.enumerable});return e};var Y=e=>U(R({},"__esModule",{value:!0}),e);var J={};q(J,{GetReferralStatusTool:()=>A,default:()=>H});module.exports=Y(J);var S=require("zod");var h="The CRM didn't respond \u2014 please try again in a minute.",m=class extends Error{constructor(t,a){super(t),this.name="CrmError",this.detail=a}};function G(e){let{apiUrl:t,agentKey:a}=e,c=e.fetchFn??fetch;return{baseUrl:t.replace(/\/api\/graphql\/?$/,""),async query(o,p){let s;try{s=await c(t,{method:"POST",headers:{"content-type":"application/json","x-agent-key":a},body:JSON.stringify({query:o,variables:p})})}catch(u){throw new m(h,u instanceof Error?u.message:String(u))}if(!s.ok)throw new m(h,`HTTP ${s.status}`);let d;try{d=await s.json()}catch(u){throw new m(h,`invalid JSON response: ${u instanceof Error?u.message:String(u)}`)}if(d.errors?.length)throw new m(`The CRM rejected the request: ${d.errors.map(u=>u.message).join("; ")}`);if(d.data===void 0||d.data===null)throw new m(h,"empty data");return d.data}}}function C(){let e=env("CRM_API_URL"),t=env("CRM_AGENT_KEY");if(!e)throw new m("Agent misconfigured: CRM_API_URL is not set.");if(!t)throw new m("Agent misconfigured: CRM_AGENT_KEY is not set.");return G({apiUrl:e,agentKey:t})}var b=`
  query AgentGlobalSearch($query: String!, $limit: Int) {
    globalSearch(query: $query, limit: $limit) { id type title subtitle href }
  }
`,y="activities { type subject body occurredAt channel direction }",T="stageChanges { field fromValue toValue changedAt createdSource changedBy { name } }",f="feeSharingAgreement feeSharingTerms partnerAgreementStatus internalOnly",X={client:{rootField:"client",document:`
      query AgentClient($id: ID!) {
        client(id: $id) {
          id name sector status hqCity hqCountry website description
          revenueLastYear revenueForecast currency profitability existingInvestors staffCount
          createdAt updatedAt
          contacts { firstName lastName email jobTitle isPrimaryContact }
          mandates { id name stage dealSize currency nextAction stageEnteredAt }
          transactions { id name stage targetRaise currency dealStatus stageEnteredAt }
          ${y}
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
          ${y}
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
          ${y}
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
          ${y}
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
          ${y}
        }
      }
    `},partner:{rootField:"partner",document:`
      query AgentPartner($id: ID!) {
        partner(id: $id) {
          id name partnerType status location organization email phone profile
          ${f} feedbackNotes
          createdAt updatedAt
          contacts { firstName lastName email }
          referredMandates { id name stage }
          referredTransactions { id name stage }
        }
      }
    `}};var F=`
  query ReferralPartnerById($id: ID!) {
    partner(id: $id) { id name }
  }
`,x=`
  query ReferralMandateById($id: ID!) {
    mandate(id: $id) { id name }
  }
`,v=`
  query ReferralClientById($id: ID!) {
    client(id: $id) { id name }
  }
`,D=`
  query ReferralTransactionById($id: ID!) {
    transaction(id: $id) { id name }
  }
`,Z=`
  query ReferralPartnerDetail($id: ID!) {
    partner(id: $id) {
      id name partnerType status location organization email phone profile
      ${f} feedbackNotes
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
      ${T}
    }
  }
`,k=`
  query ReferralMandateStatus($id: ID!) {
    mandate(id: $id) {
      id name stage stageEnteredAt daysInStage dealStatus dealSize currency
      dateOpened createdAt updatedAt clientId
      client { id name }
      referredBy { id name partnerType status ${f} }
      transactions { id name stage dealStatus targetRaise currency partnerFeeStatus partnerFeeAmount }
      ${T}
    }
  }
`,P=`
  query ReferralTransactionStatus($id: ID!) {
    transaction(id: $id) {
      id name stage stageEnteredAt dealStatus targetRaise currency
      partnerFeeStatus partnerFeeAmount
      dateOpened closedAt createdAt updatedAt clientId
      client { id name }
      referredBy { id name partnerType status ${f} }
      mandate {
        id name stage
        referredBy { id name partnerType status ${f} }
      }
      ${T}
    }
  }
`;var ee=`
  mutation ReferralCreatePartner($input: PartnerInput!) {
    createPartner(input: $input) {
      id name partnerType status organization email phone
      ${f} updatedAt
    }
  }
`,te=`
  mutation ReferralUpdatePartner($id: ID!, $input: PartnerInput!) {
    updatePartner(id: $id, input: $input) {
      id name partnerType status organization email phone
      ${f} feedbackNotes updatedAt
    }
  }
`;var _={client:"Client",investor:"Investor",mandate:"Mandate",transaction:"Transaction",engagement:"Engagement",partner:"Partner"};function w(e,t,a){let c=_[t],r=e.filter(d=>d.type===c);if(r.length===0)return{kind:"none"};let o=r.find(d=>d.id===a);if(o)return{kind:"match",result:o};let p=a.trim().toLowerCase(),s=r.filter(d=>d.title.trim().toLowerCase()===p);return s.length===1?{kind:"match",result:s[0]}:r.length===1?{kind:"match",result:r[0]}:{kind:"ambiguous",candidates:r.slice(0,5)}}var z={partner:{document:F,rootField:"partner",hrefPrefix:"/partners"},mandate:{document:x,rootField:"mandate",hrefPrefix:"/mandates"},client:{document:v,rootField:"client",hrefPrefix:"/clients"},transaction:{document:D,rootField:"transaction",hrefPrefix:"/transactions"}};function j(e){return/^c[a-z0-9]{20,32}$/i.test(e.trim())}async function N(e,t,a){let c=await e.query(b,{query:a,limit:10}),r=w(c.globalSearch,t,a);if(r.kind!=="none"||!j(a))return r;let o=z[t];if(!o)return r;try{let s=(await e.query(o.document,{id:a.trim()}))[o.rootField];if(s)return{kind:"match",result:{id:s.id,type:_[t],title:s.name,subtitle:null,href:`${o.hrefPrefix}/${s.id}`}}}catch{}return r}function M(e){return e.feeSharingAgreement===!0&&e.partnerAgreementStatus==="Signed"}var V=S.z.object({deal:S.z.string().min(1).describe("Deal (mandate or transaction) name as the user said it, or an exact id from a previous candidates list"),dealType:S.z.enum(["mandate","transaction"]).optional().describe("Narrow the lookup when the user said which pipeline the deal is in")});function I(e,t){return e?{id:e.id,name:e.name,type:e.partnerType??null,status:e.status,via:t,agreement:{feeSharingAgreement:e.feeSharingAgreement,status:e.partnerAgreementStatus,terms:e.feeSharingTerms??null,recorded:M(e)}}:null}var A=class{constructor(t){this.deps=t}deps;name="get_referral_status";description="Referral status of ONE deal (mandate or transaction): who introduced it, the stage timeline since introduction, whether the referral converted, partner fee status, and a deep link. Identify the deal by name or by an exact id from a previous candidates list.";inputSchema=V;async execute(t){let a=this.deps?.crm??C(),c=t.dealType?[t.dealType]:["mandate","transaction"],r=[];for(let l of c)r.push({type:l,resolution:await N(a,l,t.deal)});let o=r.filter(l=>l.resolution.kind==="match"),p=r.filter(l=>l.resolution.kind==="ambiguous");if(o.length===0&&p.length===0)return{status:"not_found",message:`No mandate or transaction matching "${t.deal}" was found in the CRM.`};if(o.length>1||p.length>0)return{status:"ambiguous",message:"Multiple deals match \u2014 ask the user to pick one, then call again with the chosen id and its dealType.",candidates:[...o.map(n=>n.resolution.kind==="match"?[n.resolution.result]:[]).flat(),...p.map(n=>n.resolution.kind==="ambiguous"?n.resolution.candidates:[]).flat()].slice(0,8).map(n=>({id:n.id,type:n.type,title:n.title,subtitle:n.subtitle??null}))};let s=o[0],d=s.resolution.kind==="match"?s.resolution.result.id:"";if(s.type==="mandate"){let n=(await a.query(k,{id:d})).mandate;return n?n.referredBy?{status:"ok",deal:{id:n.id,name:n.name,type:"mandate",client:n.client?.name??null,stage:n.stage,daysInStage:n.daysInStage,dealStatus:n.dealStatus,dealSize:n.dealSize??null,currency:n.currency??null,converted:n.stage==="Signed",lost:n.stage==="Lost",transactions:n.transactions},originator:I(n.referredBy,"direct"),stageTimeline:n.stageChanges.filter(E=>E.field==="stage"||E.field==="dealStatus").slice(0,20),link:`${a.baseUrl}/mandates/${n.id}`}:{status:"not_referred",message:`${n.name} has no referring partner on record \u2014 it was not introduced via a referral (or the link hasn't been recorded; link_partner_to_deal can record it).`,link:`${a.baseUrl}/mandates/${n.id}`}:{status:"not_found",message:"The mandate could not be loaded from the CRM."}}let i=(await a.query(P,{id:d})).transaction;if(!i)return{status:"not_found",message:"The transaction could not be loaded from the CRM."};let $=i.referredBy?I(i.referredBy,"direct"):I(i.mandate?.referredBy??null,"mandate");return $?{status:"ok",deal:{id:i.id,name:i.name,type:"transaction",client:i.client?.name??null,stage:i.stage,dealStatus:i.dealStatus,targetRaise:i.targetRaise??null,currency:i.currency??null,converted:i.stage==="ClosedWon",lost:i.stage==="ClosedLost",mandate:i.mandate?{name:i.mandate.name,stage:i.mandate.stage}:null},originator:$,fee:{status:i.partnerFeeStatus??null,amount:i.partnerFeeAmount??null},stageTimeline:i.stageChanges.filter(l=>l.field==="stage"||l.field==="dealStatus").slice(0,20),link:`${a.baseUrl}/transactions/${i.id}`}:{status:"not_referred",message:`${i.name} has no referring partner on record (neither directly nor via its mandate) \u2014 link_partner_to_deal can record one.`,link:`${a.baseUrl}/transactions/${i.id}`}}};var g=new A,K={version:"2.0.0",kind:"tool",name:"get_referral_status",description:"Referral status of ONE deal (mandate or transaction): who introduced it, the stage timeline since introduction, whether the referral converted, partner fee status, and a deep link. Identify the deal by name or by an exact id from a previous candidates list.",exportName:"GetReferralStatusTool",pattern:"class-definition"},H={__lua_primitive__:K,primitive:{kind:"tool",name:g.name??"get_referral_status",description:g.description??"Referral status of ONE deal (mandate or transaction): who introduced it, the stage timeline since introduction, whether the referral converted, partner fee status, and a deep link. Identify the deal by name or by an exact id from a previous candidates list.",inputSchema:g.inputSchema,execute:typeof g.execute=="function"?g.execute.bind(g):void 0,condition:typeof g.condition=="function"?g.condition.bind(g):void 0}};0&&(module.exports={GetReferralStatusTool});
