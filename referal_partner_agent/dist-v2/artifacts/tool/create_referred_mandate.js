var A=Object.defineProperty;var D=Object.getOwnPropertyDescriptor;var P=Object.getOwnPropertyNames;var w=Object.prototype.hasOwnProperty;var k=(a,e)=>{for(var r in e)A(a,r,{get:e[r],enumerable:!0})},M=(a,e,r,o)=>{if(e&&typeof e=="object"||typeof e=="function")for(let n of P(e))!w.call(a,n)&&n!==r&&A(a,n,{get:()=>e[n],enumerable:!(o=D(e,n))||o.enumerable});return a};var F=a=>M(A({},"__esModule",{value:!0}),a);var G={};k(G,{CreateReferredMandateTool:()=>y,default:()=>Y});module.exports=F(G);var c=require("zod");var g="The CRM didn't respond \u2014 please try again in a minute.",u=class extends Error{constructor(e,r){super(e),this.name="CrmError",this.detail=r}};function L(a){let{apiUrl:e,agentKey:r}=a,o=a.fetchFn??fetch;return{baseUrl:e.replace(/\/api\/graphql\/?$/,""),async query(i,d){let s;try{s=await o(e,{method:"POST",headers:{"content-type":"application/json","x-agent-key":r},body:JSON.stringify({query:i,variables:d})})}catch(l){throw new u(g,l instanceof Error?l.message:String(l))}if(!s.ok)throw new u(g,`HTTP ${s.status}`);let t;try{t=await s.json()}catch(l){throw new u(g,`invalid JSON response: ${l instanceof Error?l.message:String(l)}`)}if(t.errors?.length)throw new u(`The CRM rejected the request: ${t.errors.map(l=>l.message).join("; ")}`);if(t.data===void 0||t.data===null)throw new u(g,"empty data");return t.data}}}function S(){let a=env("CRM_API_URL"),e=env("CRM_AGENT_KEY");if(!a)throw new u("Agent misconfigured: CRM_API_URL is not set.");if(!e)throw new u("Agent misconfigured: CRM_AGENT_KEY is not set.");return L({apiUrl:a,agentKey:e})}var I=`
  query AgentGlobalSearch($query: String!, $limit: Int) {
    globalSearch(query: $query, limit: $limit) { id type title subtitle href }
  }
`,f="activities { type subject body occurredAt channel direction }",h="stageChanges { field fromValue toValue changedAt createdSource changedBy { name } }",p="feeSharingAgreement feeSharingTerms partnerAgreementStatus internalOnly",H={client:{rootField:"client",document:`
      query AgentClient($id: ID!) {
        client(id: $id) {
          id name sector status hqCity hqCountry website description
          revenueLastYear revenueForecast currency profitability existingInvestors staffCount
          createdAt updatedAt
          contacts { firstName lastName email jobTitle isPrimaryContact }
          mandates { id name stage dealSize currency nextAction stageEnteredAt }
          transactions { id name stage targetRaise currency dealStatus stageEnteredAt }
          ${f}
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
          ${f}
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
          ${f}
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
          ${f}
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
          ${f}
        }
      }
    `},partner:{rootField:"partner",document:`
      query AgentPartner($id: ID!) {
        partner(id: $id) {
          id name partnerType status location organization email phone profile
          ${p} feedbackNotes
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
`,E=`
  query ReferralMandateById($id: ID!) {
    mandate(id: $id) { id name }
  }
`,$=`
  query ReferralClientById($id: ID!) {
    client(id: $id) { id name }
  }
`,C=`
  query ReferralTransactionById($id: ID!) {
    transaction(id: $id) { id name }
  }
`,K=`
  query ReferralPartnerDetail($id: ID!) {
    partner(id: $id) {
      id name partnerType status location organization email phone profile
      ${p} feedbackNotes
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
`,Q=`
  query ReferralMandateStatus($id: ID!) {
    mandate(id: $id) {
      id name stage stageEnteredAt daysInStage dealStatus dealSize currency
      dateOpened createdAt updatedAt clientId
      client { id name }
      referredBy { id name partnerType status ${p} }
      transactions { id name stage dealStatus targetRaise currency partnerFeeStatus partnerFeeAmount }
      ${h}
    }
  }
`,V=`
  query ReferralTransactionStatus($id: ID!) {
    transaction(id: $id) {
      id name stage stageEnteredAt dealStatus targetRaise currency
      partnerFeeStatus partnerFeeAmount
      dateOpened closedAt createdAt updatedAt clientId
      client { id name }
      referredBy { id name partnerType status ${p} }
      mandate {
        id name stage
        referredBy { id name partnerType status ${p} }
      }
      ${h}
    }
  }
`;var W=`
  mutation ReferralCreatePartner($input: PartnerInput!) {
    createPartner(input: $input) {
      id name partnerType status organization email phone
      ${p} updatedAt
    }
  }
`,J=`
  mutation ReferralUpdatePartner($id: ID!, $input: PartnerInput!) {
    updatePartner(id: $id, input: $input) {
      id name partnerType status organization email phone
      ${p} feedbackNotes updatedAt
    }
  }
`,x=`
  mutation ReferralCreateMandate($input: MandateInput!) {
    createMandate(input: $input) {
      id name stage dealStatus referredById clientId updatedAt
    }
  }
`;var b=`
  mutation ReferralLogActivity($input: LogActivityInput!) {
    logActivity(input: $input) { id }
  }
`;var R={client:"Client",investor:"Investor",mandate:"Mandate",transaction:"Transaction",engagement:"Engagement",partner:"Partner"};function N(a,e,r){let o=R[e],n=a.filter(t=>t.type===o);if(n.length===0)return{kind:"none"};let i=n.find(t=>t.id===r);if(i)return{kind:"match",result:i};let d=r.trim().toLowerCase(),s=n.filter(t=>t.title.trim().toLowerCase()===d);return s.length===1?{kind:"match",result:s[0]}:n.length===1?{kind:"match",result:n[0]}:{kind:"ambiguous",candidates:n.slice(0,5)}}var O={partner:{document:_,rootField:"partner",hrefPrefix:"/partners"},mandate:{document:E,rootField:"mandate",hrefPrefix:"/mandates"},client:{document:$,rootField:"client",hrefPrefix:"/clients"},transaction:{document:C,rootField:"transaction",hrefPrefix:"/transactions"}};function q(a){return/^c[a-z0-9]{20,32}$/i.test(a.trim())}async function T(a,e,r){let o=await a.query(I,{query:r,limit:10}),n=N(o.globalSearch,e,r);if(n.kind!=="none"||!q(r))return n;let i=O[e];if(!i)return n;try{let s=(await a.query(i.document,{id:r.trim()}))[i.rootField];if(s)return{kind:"match",result:{id:s.id,type:R[e],title:s.name,subtitle:null,href:`${i.hrefPrefix}/${s.id}`}}}catch{}return n}var B=["Agribusiness","FinancialServices","FMCG","Manufacturing","RenewableEnergy","Technology","Healthcare","Banking","RealEstate","Education","Infrastructure","Aviation","Construction","Hospitality","Leasing","MediaEntertainment","Services","TransportLogistics","WaterSanitation","Energy","OilAndGas","Mining","Gambling","Alcohol","Tobacco"],v=c.z.object({client:c.z.string().min(1).describe("The EXISTING client the mandate is for \u2014 name or exact id. This tool never creates clients."),partner:c.z.string().min(1).describe("The introducing partner \u2014 name or exact id"),mandateName:c.z.string().min(1).describe("Name for the new mandate, e.g. 'Acme Foods \u2014 growth capital raise'"),dealSize:c.z.number().positive().optional(),currency:c.z.string().optional().describe("ISO currency code, e.g. USD or KES"),sector:c.z.array(c.z.enum(B)).optional(),notes:c.z.string().optional(),reason:c.z.string().min(1).describe("One line explaining the creation \u2014 written to the CRM audit trail"),confirmed:c.z.literal(!0).describe("Only pass true after the user has EXPLICITLY instructed you to create this mandate (e.g. 'create the mandate') and confirmed the exact details in this conversation. An introduction alone is NOT an instruction to create a mandate.")}),y=class{constructor(e){this.deps=e}deps;name="create_referred_mandate";description="Create a new mandate attributed to a referring partner. ONLY on explicit staff instruction to create the mandate \u2014 a recorded introduction is NOT enough; the default path for introductions is record_introduction (partner + review task). Requires an existing client. REQUIRES prior user confirmation of the exact details.";inputSchema=v;async execute(e){let r=v.safeParse(e);if(!r.success)return{status:"rejected",message:`Invalid input: ${r.error.issues[0]?.message??"schema mismatch"}. Writes require confirmed: true after explicit user approval.`};let o=this.deps?.crm??S(),n=await T(o,"client",e.client);if(n.kind==="none")return{status:"client_not_found",message:`No client matching "${e.client}" exists in the CRM. Referred mandates need an existing client record \u2014 onboarding a new client is a human workflow, not something this agent can do.`};if(n.kind==="ambiguous")return{status:"ambiguous_client",message:"Multiple clients match \u2014 ask the user to pick one, then call again with the chosen id.",candidates:n.candidates.map(t=>({id:t.id,title:t.title,subtitle:t.subtitle??null}))};let i=await T(o,"partner",e.partner);if(i.kind==="none")return{status:"partner_not_found",message:`No partner matching "${e.partner}" was found. Record the introduction first (record_introduction) so the partner exists, then create the mandate.`};if(i.kind==="ambiguous")return{status:"ambiguous_partner",message:"Multiple partners match \u2014 ask the user to pick one, then call again with the chosen id.",candidates:i.candidates.map(t=>({id:t.id,title:t.title,subtitle:t.subtitle??null}))};let d;try{d=(await o.query(x,{input:{name:e.mandateName,clientId:n.result.id,referredById:i.result.id,source:"Referral",...e.dealSize!==void 0?{dealSize:e.dealSize}:{},...e.currency!==void 0?{currency:e.currency}:{},...e.sector!==void 0?{sector:e.sector}:{},...e.notes!==void 0?{notes:e.notes}:{}}})).createMandate}catch(t){if(t instanceof u&&t.message!==g)return{status:"blocked",message:t.message};throw t}let s=!0;try{await o.query(b,{input:{type:"Note",subject:"Referral Partner Agent: referred mandate created",body:`${e.reason}
Mandate: ${d.name}, referred by ${i.result.title}`,mandateId:d.id}})}catch{s=!1}return{status:"ok",mandate:{id:d.id,name:d.name,stage:d.stage},referredBy:{id:i.result.id,name:i.result.title},client:{id:n.result.id,name:n.result.title},auditLogged:s,link:`${o.baseUrl}/mandates/${d.id}`}}};var m=new y,U={version:"2.0.0",kind:"tool",name:"create_referred_mandate",description:"Create a new mandate attributed to a referring partner. ONLY on explicit staff instruction to create the mandate \u2014 a recorded introduction is NOT enough; the default path for introductions is record_introduction (partner + review task). Requires an existing client. REQUIRES prior user confirmation of the exact details.",exportName:"CreateReferredMandateTool",pattern:"class-definition"},Y={__lua_primitive__:U,primitive:{kind:"tool",name:m.name??"create_referred_mandate",description:m.description??"Create a new mandate attributed to a referring partner. ONLY on explicit staff instruction to create the mandate \u2014 a recorded introduction is NOT enough; the default path for introductions is record_introduction (partner + review task). Requires an existing client. REQUIRES prior user confirmation of the exact details.",inputSchema:m.inputSchema,execute:typeof m.execute=="function"?m.execute.bind(m):void 0,condition:typeof m.condition=="function"?m.condition.bind(m):void 0}};0&&(module.exports={CreateReferredMandateTool});
