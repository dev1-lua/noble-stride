var y=Object.defineProperty;var L=Object.getOwnPropertyDescriptor;var U=Object.getOwnPropertyNames;var q=Object.prototype.hasOwnProperty;var B=(t,e)=>{for(var r in e)y(t,r,{get:e[r],enumerable:!0})},j=(t,e,r,s)=>{if(e&&typeof e=="object"||typeof e=="function")for(let n of U(e))!q.call(t,n)&&n!==r&&y(t,n,{get:()=>e[n],enumerable:!(s=L(e,n))||s.enumerable});return t};var G=t=>j(y({},"__esModule",{value:!0}),t);var J={};B(J,{UpdateFeeStatusTool:()=>h,default:()=>W});module.exports=G(J);var p=require("zod");var f="The CRM didn't respond \u2014 please try again in a minute.",u=class extends Error{constructor(e,r){super(e),this.name="CrmError",this.detail=r}};function Y(t){let{apiUrl:e,agentKey:r}=t,s=t.fetchFn??fetch;return{baseUrl:e.replace(/\/api\/graphql\/?$/,""),async query(l,o){let a;try{a=await s(e,{method:"POST",headers:{"content-type":"application/json","x-agent-key":r},body:JSON.stringify({query:l,variables:o})})}catch(c){throw new u(f,c instanceof Error?c.message:String(c))}if(!a.ok)throw new u(f,`HTTP ${a.status}`);let i;try{i=await a.json()}catch(c){throw new u(f,`invalid JSON response: ${c instanceof Error?c.message:String(c)}`)}if(i.errors?.length)throw new u(`The CRM rejected the request: ${i.errors.map(c=>c.message).join("; ")}`);if(i.data===void 0||i.data===null)throw new u(f,"empty data");return i.data}}}function _(){let t=env("CRM_API_URL"),e=env("CRM_AGENT_KEY");if(!t)throw new u("Agent misconfigured: CRM_API_URL is not set.");if(!e)throw new u("Agent misconfigured: CRM_AGENT_KEY is not set.");return Y({apiUrl:t,agentKey:e})}var E=`
  query AgentGlobalSearch($query: String!, $limit: Int) {
    globalSearch(query: $query, limit: $limit) { id type title subtitle href }
  }
`,A="activities { type subject body occurredAt channel direction }",R="stageChanges { field fromValue toValue changedAt createdSource changedBy { name } }",g="feeSharingAgreement feeSharingTerms partnerAgreementStatus internalOnly",ee={client:{rootField:"client",document:`
      query AgentClient($id: ID!) {
        client(id: $id) {
          id name sector status hqCity hqCountry website description
          revenueLastYear revenueForecast currency profitability existingInvestors staffCount
          createdAt updatedAt
          contacts { firstName lastName email jobTitle isPrimaryContact }
          mandates { id name stage dealSize currency nextAction stageEnteredAt }
          transactions { id name stage targetRaise currency dealStatus stageEnteredAt }
          ${A}
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
          ${A}
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
          ${A}
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
          ${A}
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
          ${A}
        }
      }
    `},partner:{rootField:"partner",document:`
      query AgentPartner($id: ID!) {
        partner(id: $id) {
          id name partnerType status location organization email phone profile
          ${g} feedbackNotes
          createdAt updatedAt
          contacts { firstName lastName email }
          referredMandates { id name stage }
          referredTransactions { id name stage }
        }
      }
    `}};var $=`
  query ReferralPartnerById($id: ID!) {
    partner(id: $id) { id name }
  }
`,C=`
  query ReferralMandateById($id: ID!) {
    mandate(id: $id) { id name }
  }
`,F=`
  query ReferralClientById($id: ID!) {
    client(id: $id) { id name }
  }
`,x=`
  query ReferralTransactionById($id: ID!) {
    transaction(id: $id) { id name }
  }
`,te=`
  query ReferralPartnerDetail($id: ID!) {
    partner(id: $id) {
      id name partnerType status location organization email phone profile
      ${g} feedbackNotes
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
`,ne=`
  query ReferralMandateStatus($id: ID!) {
    mandate(id: $id) {
      id name stage stageEnteredAt daysInStage dealStatus dealSize currency
      dateOpened createdAt updatedAt clientId
      client { id name }
      referredBy { id name partnerType status ${g} }
      transactions { id name stage dealStatus targetRaise currency partnerFeeStatus partnerFeeAmount }
      ${R}
    }
  }
`,b=`
  query ReferralTransactionStatus($id: ID!) {
    transaction(id: $id) {
      id name stage stageEnteredAt dealStatus targetRaise currency
      partnerFeeStatus partnerFeeAmount
      dateOpened closedAt createdAt updatedAt clientId
      client { id name }
      referredBy { id name partnerType status ${g} }
      mandate {
        id name stage
        referredBy { id name partnerType status ${g} }
      }
      ${R}
    }
  }
`;var re=`
  mutation ReferralCreatePartner($input: PartnerInput!) {
    createPartner(input: $input) {
      id name partnerType status organization email phone
      ${g} updatedAt
    }
  }
`,ae=`
  mutation ReferralUpdatePartner($id: ID!, $input: PartnerInput!) {
    updatePartner(id: $id, input: $input) {
      id name partnerType status organization email phone
      ${g} feedbackNotes updatedAt
    }
  }
`;var D=`
  mutation ReferralUpdateTransaction($id: ID!, $input: TransactionInput!) {
    updateTransaction(id: $id, input: $input) {
      id name stage dealStatus referredById partnerFeeStatus partnerFeeAmount updatedAt
    }
  }
`;var v=`
  mutation ReferralLogActivity($input: LogActivityInput!) {
    logActivity(input: $input) { id }
  }
`;var S={client:"Client",investor:"Investor",mandate:"Mandate",transaction:"Transaction",engagement:"Engagement",partner:"Partner"};function P(t,e,r){let s=S[e],n=t.filter(i=>i.type===s);if(n.length===0)return{kind:"none"};let l=n.find(i=>i.id===r);if(l)return{kind:"match",result:l};let o=r.trim().toLowerCase(),a=n.filter(i=>i.title.trim().toLowerCase()===o);return a.length===1?{kind:"match",result:a[0]}:n.length===1?{kind:"match",result:n[0]}:{kind:"ambiguous",candidates:n.slice(0,5)}}var z={partner:{document:$,rootField:"partner",hrefPrefix:"/partners"},mandate:{document:C,rootField:"mandate",hrefPrefix:"/mandates"},client:{document:F,rootField:"client",hrefPrefix:"/clients"},transaction:{document:x,rootField:"transaction",hrefPrefix:"/transactions"}};function K(t){return/^c[a-z0-9]{20,32}$/i.test(t.trim())}async function N(t,e,r){let s=await t.query(E,{query:r,limit:10}),n=P(s.globalSearch,e,r);if(n.kind!=="none"||!K(r))return n;let l=z[e];if(!l)return n;try{let a=(await t.query(l.document,{id:r.trim()}))[l.rootField];if(a)return{kind:"match",result:{id:a.id,type:S[e],title:a.name,subtitle:null,href:`${l.hrefPrefix}/${a.id}`}}}catch{}return n}function V(t){return t.feeSharingAgreement===!0&&t.partnerAgreementStatus==="Signed"}function w(t,e){return e.partnerFeeStatus!==void 0&&e.partnerFeeStatus!=="NotDue"||e.partnerFeeAmount!==void 0?t?V(t)?{allowed:!0,warning:!t.feeSharingTerms||t.feeSharingTerms.trim()===""?`${t.name} has a signed fee-sharing agreement but no terms recorded \u2014 consider adding feeSharingTerms via update_partner.`:void 0}:{allowed:!1,message:`${t.name} has no recorded fee-sharing agreement (feeSharingAgreement: ${t.feeSharingAgreement}, agreement status: ${t.partnerAgreementStatus}) \u2014 fee status and amounts cannot be recorded until one is. To proceed, first record the signed agreement on the partner via update_partner (feeSharingAgreement: true, partnerAgreementStatus: Signed, plus the terms), then retry.`}:{allowed:!1,message:"This deal has no referring partner on record \u2014 a partner fee cannot be recorded without one. Link the originating partner to the deal first (link_partner_to_deal)."}:{allowed:!0}}var H=p.z.object({partnerFeeStatus:p.z.enum(["NotDue","Due","Invoiced","Paid"]).optional(),partnerFeeAmount:p.z.number().nonnegative().optional()}).refine(t=>Object.values(t).some(e=>e!==void 0),{message:"set must change at least one field"}),k=p.z.object({transaction:p.z.string().min(1).describe("The transaction the fee is on \u2014 name or exact id (partner fees live on transactions)"),set:H.describe("Only the fields to change"),reason:p.z.string().min(1).describe("One line explaining the change \u2014 written to the CRM audit trail"),confirmed:p.z.literal(!0).describe("Only pass true after the user has explicitly confirmed this exact fee change in this conversation. If you have not asked yet, ask first \u2014 do not call this tool.")}),h=class{constructor(e){this.deps=e}deps;name="update_fee_status";description="Record the status (NotDue/Due/Invoiced/Paid) and amount of a referring partner's fee on a transaction. REFUSED unless the partner has a recorded, signed fee-sharing agreement \u2014 record the agreement first via update_partner. Records facts only: never computes, negotiates, or pays fees. REQUIRES prior user confirmation of the exact change.";inputSchema=k;async execute(e){let r=k.safeParse(e);if(!r.success)return{status:"rejected",message:`Invalid input: ${r.error.issues[0]?.message??"schema mismatch"}. Writes require confirmed: true after explicit user approval.`};let s=this.deps?.crm??_(),n=await N(s,"transaction",e.transaction);if(n.kind==="none")return{status:"not_found",message:`No transaction matching "${e.transaction}" was found in the CRM.`};if(n.kind==="ambiguous")return{status:"ambiguous",message:"Multiple transactions match \u2014 ask the user to pick one, then call again with the chosen id.",candidates:n.candidates.map(d=>({id:d.id,title:d.title,subtitle:d.subtitle??null}))};let o=(await s.query(b,{id:n.result.id})).transaction;if(!o)return{status:"not_found",message:"The transaction could not be loaded from the CRM."};let a=o.referredBy??o.mandate?.referredBy??null,i=w(a,e.set);if(!i.allowed)return{status:"refused",message:i.message};let c=Object.fromEntries(Object.entries(e.set).filter(([,d])=>d!==void 0)),T;try{T=(await s.query(D,{id:o.id,input:{name:o.name,clientId:o.clientId,...c}})).updateTransaction}catch(d){if(d instanceof u&&d.message!==f)return{status:"blocked",message:d.message};throw d}let I=!0;try{let d=Object.entries(c).map(([M,O])=>`${M} \u2192 ${String(O)}`).join(", ");await s.query(v,{input:{type:"Note",subject:"Referral Partner Agent: fee status updated",body:`${e.reason}
Partner: ${a?.name??"(unknown)"}
Changed: ${d}`,transactionId:o.id}})}catch{I=!1}return{status:"ok",updated:T,partner:a?{id:a.id,name:a.name}:null,previous:{partnerFeeStatus:o.partnerFeeStatus??null,partnerFeeAmount:o.partnerFeeAmount??null},...i.warning?{warning:i.warning}:{},auditLogged:I,link:`${s.baseUrl}/transactions/${o.id}`}}};var m=new h,Q={version:"2.0.0",kind:"tool",name:"update_fee_status",description:"Record the status (NotDue/Due/Invoiced/Paid) and amount of a referring partner's fee on a transaction. REFUSED unless the partner has a recorded, signed fee-sharing agreement \u2014 record the agreement first via update_partner. Records facts only: never computes, negotiates, or pays fees. REQUIRES prior user confirmation of the exact change.",exportName:"UpdateFeeStatusTool",pattern:"class-definition"},W={__lua_primitive__:Q,primitive:{kind:"tool",name:m.name??"update_fee_status",description:m.description??"Record the status (NotDue/Due/Invoiced/Paid) and amount of a referring partner's fee on a transaction. REFUSED unless the partner has a recorded, signed fee-sharing agreement \u2014 record the agreement first via update_partner. Records facts only: never computes, negotiates, or pays fees. REQUIRES prior user confirmation of the exact change.",inputSchema:m.inputSchema,execute:typeof m.execute=="function"?m.execute.bind(m):void 0,condition:typeof m.condition=="function"?m.condition.bind(m):void 0}};0&&(module.exports={UpdateFeeStatusTool});
