var I=Object.defineProperty;var O=Object.getOwnPropertyDescriptor;var U=Object.getOwnPropertyNames;var Y=Object.prototype.hasOwnProperty;var G=(n,e)=>{for(var i in e)I(n,i,{get:e[i],enumerable:!0})},j=(n,e,i,s)=>{if(e&&typeof e=="object"||typeof e=="function")for(let t of U(e))!Y.call(n,t)&&t!==i&&I(n,t,{get:()=>e[t],enumerable:!(s=O(e,t))||s.enumerable});return n};var z=n=>j(I({},"__esModule",{value:!0}),n);var J={};G(J,{LinkPartnerToDealTool:()=>R,default:()=>W});module.exports=z(J);var g=require("zod");var A="The CRM didn't respond \u2014 please try again in a minute.",u=class extends Error{constructor(e,i){super(e),this.name="CrmError",this.detail=i}};function K(n){let{apiUrl:e,agentKey:i}=n,s=n.fetchFn??fetch;return{baseUrl:e.replace(/\/api\/graphql\/?$/,""),async query(d,p){let o;try{o=await s(e,{method:"POST",headers:{"content-type":"application/json","x-agent-key":i},body:JSON.stringify({query:d,variables:p})})}catch(c){throw new u(A,c instanceof Error?c.message:String(c))}if(!o.ok)throw new u(A,`HTTP ${o.status}`);let r;try{r=await o.json()}catch(c){throw new u(A,`invalid JSON response: ${c instanceof Error?c.message:String(c)}`)}if(r.errors?.length)throw new u(`The CRM rejected the request: ${r.errors.map(c=>c.message).join("; ")}`);if(r.data===void 0||r.data===null)throw new u(A,"empty data");return r.data}}}function b(){let n=env("CRM_API_URL"),e=env("CRM_AGENT_KEY");if(!n)throw new u("Agent misconfigured: CRM_API_URL is not set.");if(!e)throw new u("Agent misconfigured: CRM_AGENT_KEY is not set.");return K({apiUrl:n,agentKey:e})}var x=`
  query AgentGlobalSearch($query: String!, $limit: Int) {
    globalSearch(query: $query, limit: $limit) { id type title subtitle href }
  }
`,h="activities { type subject body occurredAt channel direction }",_="stageChanges { field fromValue toValue changedAt createdSource changedBy { name } }",y="feeSharingAgreement feeSharingTerms partnerAgreementStatus internalOnly",ee={client:{rootField:"client",document:`
      query AgentClient($id: ID!) {
        client(id: $id) {
          id name sector status hqCity hqCountry website description
          revenueLastYear revenueForecast currency profitability existingInvestors staffCount
          createdAt updatedAt
          contacts { firstName lastName email jobTitle isPrimaryContact }
          mandates { id name stage dealSize currency nextAction stageEnteredAt }
          transactions { id name stage targetRaise currency dealStatus stageEnteredAt }
          ${h}
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
          ${h}
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
          ${h}
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
          ${h}
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
          ${h}
        }
      }
    `},partner:{rootField:"partner",document:`
      query AgentPartner($id: ID!) {
        partner(id: $id) {
          id name partnerType status location organization email phone profile
          ${y} feedbackNotes
          createdAt updatedAt
          contacts { firstName lastName email }
          referredMandates { id name stage }
          referredTransactions { id name stage }
        }
      }
    `}};var C=`
  query ReferralPartnerById($id: ID!) {
    partner(id: $id) { id name }
  }
`,k=`
  query ReferralMandateById($id: ID!) {
    mandate(id: $id) { id name }
  }
`,D=`
  query ReferralClientById($id: ID!) {
    client(id: $id) { id name }
  }
`,N=`
  query ReferralTransactionById($id: ID!) {
    transaction(id: $id) { id name }
  }
`,te=`
  query ReferralPartnerDetail($id: ID!) {
    partner(id: $id) {
      id name partnerType status location organization email phone profile
      ${y} feedbackNotes
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
      ${_}
    }
  }
`,v=`
  query ReferralMandateStatus($id: ID!) {
    mandate(id: $id) {
      id name stage stageEnteredAt daysInStage dealStatus dealSize currency
      dateOpened createdAt updatedAt clientId
      client { id name }
      referredBy { id name partnerType status ${y} }
      transactions { id name stage dealStatus targetRaise currency partnerFeeStatus partnerFeeAmount }
      ${_}
    }
  }
`,P=`
  query ReferralTransactionStatus($id: ID!) {
    transaction(id: $id) {
      id name stage stageEnteredAt dealStatus targetRaise currency
      partnerFeeStatus partnerFeeAmount
      dateOpened closedAt createdAt updatedAt clientId
      client { id name }
      referredBy { id name partnerType status ${y} }
      mandate {
        id name stage
        referredBy { id name partnerType status ${y} }
      }
      ${_}
    }
  }
`;var ne=`
  mutation ReferralCreatePartner($input: PartnerInput!) {
    createPartner(input: $input) {
      id name partnerType status organization email phone
      ${y} updatedAt
    }
  }
`,ae=`
  mutation ReferralUpdatePartner($id: ID!, $input: PartnerInput!) {
    updatePartner(id: $id, input: $input) {
      id name partnerType status organization email phone
      ${y} feedbackNotes updatedAt
    }
  }
`;var F=`
  mutation ReferralUpdateMandate($id: ID!, $input: MandateInput!) {
    updateMandate(id: $id, input: $input) {
      id name stage dealStatus referredById clientId updatedAt
    }
  }
`,M=`
  mutation ReferralUpdateTransaction($id: ID!, $input: TransactionInput!) {
    updateTransaction(id: $id, input: $input) {
      id name stage dealStatus referredById partnerFeeStatus partnerFeeAmount updatedAt
    }
  }
`;var w=`
  mutation ReferralLogActivity($input: LogActivityInput!) {
    logActivity(input: $input) { id }
  }
`;var S={client:"Client",investor:"Investor",mandate:"Mandate",transaction:"Transaction",engagement:"Engagement",partner:"Partner"};function L(n,e,i){let s=S[e],t=n.filter(r=>r.type===s);if(t.length===0)return{kind:"none"};let d=t.find(r=>r.id===i);if(d)return{kind:"match",result:d};let p=i.trim().toLowerCase(),o=t.filter(r=>r.title.trim().toLowerCase()===p);return o.length===1?{kind:"match",result:o[0]}:t.length===1?{kind:"match",result:t[0]}:{kind:"ambiguous",candidates:t.slice(0,5)}}var H={partner:{document:C,rootField:"partner",hrefPrefix:"/partners"},mandate:{document:k,rootField:"mandate",hrefPrefix:"/mandates"},client:{document:D,rootField:"client",hrefPrefix:"/clients"},transaction:{document:N,rootField:"transaction",hrefPrefix:"/transactions"}};function Q(n){return/^c[a-z0-9]{20,32}$/i.test(n.trim())}async function $(n,e,i){let s=await n.query(x,{query:i,limit:10}),t=L(s.globalSearch,e,i);if(t.kind!=="none"||!Q(i))return t;let d=H[e];if(!d)return t;try{let o=(await n.query(d.document,{id:i.trim()}))[d.rootField];if(o)return{kind:"match",result:{id:o.id,type:S[e],title:o.name,subtitle:null,href:`${d.hrefPrefix}/${o.id}`}}}catch{}return t}var q=g.z.object({partner:g.z.string().min(1).describe("The referring partner \u2014 name or exact id"),deal:g.z.string().min(1).describe("The deal to attribute \u2014 name or exact id"),dealType:g.z.enum(["mandate","transaction"]).describe("Which pipeline the deal is in"),overrideExisting:g.z.boolean().optional().describe("Only after the user has seen the current originator and explicitly chosen to replace them"),reason:g.z.string().min(1).describe("One line explaining the link \u2014 written to the CRM audit trail"),confirmed:g.z.literal(!0).describe("Only pass true after the user has explicitly confirmed this exact partner-to-deal link in this conversation. If you have not asked yet, ask first \u2014 do not call this tool.")}),R=class{constructor(e){this.deps=e}deps;name="link_partner_to_deal";description="Attribute an existing deal (mandate or transaction) to a referring partner by setting its referredBy link. Reports a conflict if a different partner is already recorded as originator \u2014 replacing them requires the user to explicitly opt in. REQUIRES prior user confirmation of the exact link.";inputSchema=q;async execute(e){let i=q.safeParse(e);if(!i.success)return{status:"rejected",message:`Invalid input: ${i.error.issues[0]?.message??"schema mismatch"}. Writes require confirmed: true after explicit user approval.`};let s=this.deps?.crm??b(),t=await $(s,"partner",e.partner);if(t.kind==="none")return{status:"partner_not_found",message:`No partner matching "${e.partner}" was found in the CRM.`};if(t.kind==="ambiguous")return{status:"ambiguous_partner",message:"Multiple partners match \u2014 ask the user to pick one, then call again with the chosen id.",candidates:t.candidates.map(a=>({id:a.id,title:a.title,subtitle:a.subtitle??null}))};let d=await $(s,e.dealType,e.deal);if(d.kind==="none")return{status:"deal_not_found",message:`No ${e.dealType} matching "${e.deal}" was found in the CRM.`};if(d.kind==="ambiguous")return{status:"ambiguous_deal",message:"Multiple deals match \u2014 ask the user to pick one, then call again with the chosen id.",candidates:d.candidates.map(a=>({id:a.id,title:a.title,subtitle:a.subtitle??null}))};let p=t.result.id,o=t.result.title,r=d.result.id,c=e.dealType==="mandate"?"/mandates":"/transactions",f,T,l;if(e.dealType==="mandate"){let a=await s.query(v,{id:r});if(!a.mandate)return{status:"deal_not_found",message:"The mandate could not be loaded from the CRM."};f=a.mandate.name,T=a.mandate.clientId,l=a.mandate.referredBy}else{let a=await s.query(P,{id:r});if(!a.transaction)return{status:"deal_not_found",message:"The transaction could not be loaded from the CRM."};f=a.transaction.name,T=a.transaction.clientId,l=a.transaction.referredBy}if(l&&l.id===p)return{status:"already_linked",message:`${f} is already attributed to ${o} \u2014 nothing to change.`,link:`${s.baseUrl}${c}/${r}`};if(l&&!e.overrideExisting)return{status:"conflict",message:`${f} is already attributed to ${l.name}. Replacing the originator changes referral credit \u2014 show this to the user, and only call again with overrideExisting: true if they explicitly choose to replace.`,currentOriginator:{name:l.name},link:`${s.baseUrl}${c}/${r}`};let B=e.dealType==="mandate"?F:M;try{await s.query(B,{id:r,input:{name:f,clientId:T,referredById:p}})}catch(a){if(a instanceof u&&a.message!==A)return{status:"blocked",message:a.message};throw a}let E=!0;try{await s.query(w,{input:{type:"Note",subject:"Referral Partner Agent: partner linked to deal",body:`${e.reason}
${f} attributed to ${o}${l?` (replacing ${l.name})`:""}`,[e.dealType==="mandate"?"mandateId":"transactionId"]:r}})}catch{E=!1}return{status:"ok",deal:{id:r,name:f,type:e.dealType},originator:{id:p,name:o},replaced:l?{name:l.name}:null,auditLogged:E,link:`${s.baseUrl}${c}/${r}`}}};var m=new R,V={version:"2.0.0",kind:"tool",name:"link_partner_to_deal",description:"Attribute an existing deal (mandate or transaction) to a referring partner by setting its referredBy link. Reports a conflict if a different partner is already recorded as originator \u2014 replacing them requires the user to explicitly opt in. REQUIRES prior user confirmation of the exact link.",exportName:"LinkPartnerToDealTool",pattern:"class-definition"},W={__lua_primitive__:V,primitive:{kind:"tool",name:m.name??"link_partner_to_deal",description:m.description??"Attribute an existing deal (mandate or transaction) to a referring partner by setting its referredBy link. Reports a conflict if a different partner is already recorded as originator \u2014 replacing them requires the user to explicitly opt in. REQUIRES prior user confirmation of the exact link.",inputSchema:m.inputSchema,execute:typeof m.execute=="function"?m.execute.bind(m):void 0,condition:typeof m.condition=="function"?m.condition.bind(m):void 0}};0&&(module.exports={LinkPartnerToDealTool});
