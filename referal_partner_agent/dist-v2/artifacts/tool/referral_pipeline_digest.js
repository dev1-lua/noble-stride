var R=Object.defineProperty;var b=Object.getOwnPropertyDescriptor;var P=Object.getOwnPropertyNames;var k=Object.prototype.hasOwnProperty;var w=(r,t)=>{for(var a in t)R(r,a,{get:t[a],enumerable:!0})},F=(r,t,a,d)=>{if(t&&typeof t=="object"||typeof t=="function")for(let e of P(t))!k.call(r,e)&&e!==a&&R(r,e,{get:()=>t[e],enumerable:!(d=b(t,e))||d.enumerable});return r};var M=r=>F(R({},"__esModule",{value:!0}),r);var K={};w(K,{ReferralPipelineDigestTool:()=>f,default:()=>G});module.exports=M(K);var A=require("zod");var y="The CRM didn't respond \u2014 please try again in a minute.",u=class extends Error{constructor(t,a){super(t),this.name="CrmError",this.detail=a}};function L(r){let{apiUrl:t,agentKey:a}=r,d=r.fetchFn??fetch;return{baseUrl:t.replace(/\/api\/graphql\/?$/,""),async query(o,c){let s;try{s=await d(t,{method:"POST",headers:{"content-type":"application/json","x-agent-key":a},body:JSON.stringify({query:o,variables:c})})}catch(i){throw new u(y,i instanceof Error?i.message:String(i))}if(!s.ok)throw new u(y,`HTTP ${s.status}`);let n;try{n=await s.json()}catch(i){throw new u(y,`invalid JSON response: ${i instanceof Error?i.message:String(i)}`)}if(n.errors?.length)throw new u(`The CRM rejected the request: ${n.errors.map(i=>i.message).join("; ")}`);if(n.data===void 0||n.data===null)throw new u(y,"empty data");return n.data}}}function T(){let r=env("CRM_API_URL"),t=env("CRM_AGENT_KEY");if(!r)throw new u("Agent misconfigured: CRM_API_URL is not set.");if(!t)throw new u("Agent misconfigured: CRM_AGENT_KEY is not set.");return L({apiUrl:r,agentKey:t})}var h=`
  query AgentGlobalSearch($query: String!, $limit: Int) {
    globalSearch(query: $query, limit: $limit) { id type title subtitle href }
  }
`,g="activities { type subject body occurredAt channel direction }",S="stageChanges { field fromValue toValue changedAt createdSource changedBy { name } }",m="feeSharingAgreement feeSharingTerms partnerAgreementStatus internalOnly",V={client:{rootField:"client",document:`
      query AgentClient($id: ID!) {
        client(id: $id) {
          id name sector status hqCity hqCountry website description
          revenueLastYear revenueForecast currency profitability existingInvestors staffCount
          createdAt updatedAt
          contacts { firstName lastName email jobTitle isPrimaryContact }
          mandates { id name stage dealSize currency nextAction stageEnteredAt }
          transactions { id name stage targetRaise currency dealStatus stageEnteredAt }
          ${g}
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
          ${g}
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
          ${g}
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
          ${g}
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
          ${g}
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
`,D=`
  query ReferralClientById($id: ID!) {
    client(id: $id) { id name }
  }
`,E=`
  query ReferralTransactionById($id: ID!) {
    transaction(id: $id) { id name }
  }
`,J=`
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
      ${S}
    }
  }
`,Q=`
  query ReferralMandateStatus($id: ID!) {
    mandate(id: $id) {
      id name stage stageEnteredAt daysInStage dealStatus dealSize currency
      dateOpened createdAt updatedAt clientId
      client { id name }
      referredBy { id name partnerType status ${m} }
      transactions { id name stage dealStatus targetRaise currency partnerFeeStatus partnerFeeAmount }
      ${S}
    }
  }
`,W=`
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
      ${S}
    }
  }
`,C=`
  query ReferralDealsScan {
    partners {
      id name
      referredMandates { id name stage dealStatus updatedAt }
      referredTransactions { id name stage dealStatus mandateId updatedAt }
    }
  }
`;var X=`
  mutation ReferralCreatePartner($input: PartnerInput!) {
    createPartner(input: $input) {
      id name partnerType status organization email phone
      ${m} updatedAt
    }
  }
`,Z=`
  mutation ReferralUpdatePartner($id: ID!, $input: PartnerInput!) {
    updatePartner(id: $id, input: $input) {
      id name partnerType status organization email phone
      ${m} feedbackNotes updatedAt
    }
  }
`;var I={client:"Client",investor:"Investor",mandate:"Mandate",transaction:"Transaction",engagement:"Engagement",partner:"Partner"};function v(r,t,a){let d=I[t],e=r.filter(n=>n.type===d);if(e.length===0)return{kind:"none"};let o=e.find(n=>n.id===a);if(o)return{kind:"match",result:o};let c=a.trim().toLowerCase(),s=e.filter(n=>n.title.trim().toLowerCase()===c);return s.length===1?{kind:"match",result:s[0]}:e.length===1?{kind:"match",result:e[0]}:{kind:"ambiguous",candidates:e.slice(0,5)}}var q={partner:{document:_,rootField:"partner",hrefPrefix:"/partners"},mandate:{document:$,rootField:"mandate",hrefPrefix:"/mandates"},client:{document:D,rootField:"client",hrefPrefix:"/clients"},transaction:{document:E,rootField:"transaction",hrefPrefix:"/transactions"}};function O(r){return/^c[a-z0-9]{20,32}$/i.test(r.trim())}async function x(r,t,a){let d=await r.query(h,{query:a,limit:10}),e=v(d.globalSearch,t,a);if(e.kind!=="none"||!O(a))return e;let o=q[t];if(!o)return e;try{let s=(await r.query(o.document,{id:a.trim()}))[o.rootField];if(s)return{kind:"match",result:{id:s.id,type:I[t],title:s.name,subtitle:null,href:`${o.hrefPrefix}/${s.id}`}}}catch{}return e}function B(r){let t=[];for(let a of r){let d=new Set(a.referredMandates.map(e=>e.id));for(let e of a.referredMandates)t.push({dealKey:`mandate:${e.id}`,dealId:e.id,dealName:e.name,dealType:"mandate",partnerId:a.id,partnerName:a.name,stage:e.stage,dealStatus:e.dealStatus,link:`/mandates/${e.id}`,converted:e.stage==="Signed",lost:e.stage==="Lost",updatedAt:e.updatedAt});for(let e of a.referredTransactions)e.mandateId!=null&&d.has(e.mandateId)||t.push({dealKey:`transaction:${e.id}`,dealId:e.id,dealName:e.name,dealType:"transaction",partnerId:a.id,partnerName:a.name,stage:e.stage,dealStatus:e.dealStatus,link:`/transactions/${e.id}`,converted:e.stage==="ClosedWon",lost:e.stage==="ClosedLost",updatedAt:e.updatedAt})}return t}async function N(r){let t=await r.query(C);return B(t.partners)}var U=864e5,Y=A.z.object({partner:A.z.string().optional().describe("Scope the digest to one partner \u2014 name as the user said it, or an exact id"),days:A.z.number().int().min(1).max(365).optional().describe("Only include deals updated in the last N days; omit for all referred deals")}),f=class{constructor(t){this.deps=t}deps;name="referral_pipeline_digest";description="Digest of every referred deal in the pipeline, grouped by introducing partner: stage, status, conversion, deep links. Optionally scoped to one partner and/or to deals updated in the last N days.";inputSchema=Y;async execute(t){let a=this.deps??{crm:T()},{crm:d}=a,e=a.now?a.now():new Date,o;if(t.partner){let n=await x(d,"partner",t.partner);if(n.kind==="none")return{status:"not_found",message:`No partner matching "${t.partner}" was found in the CRM.`};if(n.kind==="ambiguous")return{status:"ambiguous",message:"Multiple partners match \u2014 ask the user to pick one, then call again with the chosen id.",candidates:n.candidates.map(i=>({id:i.id,title:i.title,subtitle:i.subtitle??null}))};o=n.result.id}let c=await N(d);if(o&&(c=c.filter(n=>n.partnerId===o)),t.days!==void 0){let n=e.getTime()-t.days*U;c=c.filter(i=>i.updatedAt&&new Date(i.updatedAt).getTime()>=n)}let s=new Map;for(let n of c){let i=s.get(n.partnerId)??{partner:n.partnerName,deals:[]};i.deals.push(n),s.set(n.partnerId,i)}return{status:"ok",windowDays:t.days??null,totals:{referredDeals:c.length,converted:c.filter(n=>n.converted).length,lost:c.filter(n=>n.lost).length,partners:s.size},byPartner:[...s.entries()].map(([n,i])=>({partnerId:n,partner:i.partner,counts:{referred:i.deals.length,converted:i.deals.filter(l=>l.converted).length,lost:i.deals.filter(l=>l.lost).length},deals:i.deals.map(l=>({name:l.dealName,type:l.dealType,stage:l.stage,dealStatus:l.dealStatus,converted:l.converted,lost:l.lost,link:`${d.baseUrl}${l.link}`}))}))}}};var p=new f,z={version:"2.0.0",kind:"tool",name:"referral_pipeline_digest",description:"Digest of every referred deal in the pipeline, grouped by introducing partner: stage, status, conversion, deep links. Optionally scoped to one partner and/or to deals updated in the last N days.",exportName:"ReferralPipelineDigestTool",pattern:"class-definition"},G={__lua_primitive__:z,primitive:{kind:"tool",name:p.name??"referral_pipeline_digest",description:p.description??"Digest of every referred deal in the pipeline, grouped by introducing partner: stage, status, conversion, deep links. Optionally scoped to one partner and/or to deals updated in the last N days.",inputSchema:p.inputSchema,execute:typeof p.execute=="function"?p.execute.bind(p):void 0,condition:typeof p.condition=="function"?p.condition.bind(p):void 0}};0&&(module.exports={ReferralPipelineDigestTool});
