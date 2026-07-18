var y=Object.defineProperty;var k=Object.getOwnPropertyDescriptor;var F=Object.getOwnPropertyNames;var P=Object.prototype.hasOwnProperty;var M=(e,n)=>{for(var r in n)y(e,r,{get:n[r],enumerable:!0})},L=(e,n,r,s)=>{if(n&&typeof n=="object"||typeof n=="function")for(let t of F(n))!P.call(e,t)&&t!==r&&y(e,t,{get:()=>n[t],enumerable:!(s=k(n,t))||s.enumerable});return e};var O=e=>L(y({},"__esModule",{value:!0}),e);var G={};M(G,{default:()=>W});module.exports=O(G);var f="The CRM didn't respond \u2014 please try again in a minute.",o=class extends Error{constructor(n,r){super(n),this.name="CrmError",this.detail=r}};function U(e){let{apiUrl:n,agentKey:r}=e,s=e.fetchFn??fetch;return{baseUrl:n.replace(/\/api\/graphql\/?$/,""),async query(g,m){let l;try{l=await s(n,{method:"POST",headers:{"content-type":"application/json","x-agent-key":r},body:JSON.stringify({query:g,variables:m})})}catch(d){throw new o(f,d instanceof Error?d.message:String(d))}if(!l.ok)throw new o(f,`HTTP ${l.status}`);let c;try{c=await l.json()}catch(d){throw new o(f,`invalid JSON response: ${d instanceof Error?d.message:String(d)}`)}if(c.errors?.length)throw new o(`The CRM rejected the request: ${c.errors.map(d=>d.message).join("; ")}`);if(c.data===void 0||c.data===null)throw new o(f,"empty data");return c.data}}}function E(){let e=env("CRM_API_URL"),n=env("CRM_AGENT_KEY");if(!e)throw new o("Agent misconfigured: CRM_API_URL is not set.");if(!n)throw new o("Agent misconfigured: CRM_AGENT_KEY is not set.");return U({apiUrl:e,agentKey:n})}var p="activities { type subject body occurredAt channel direction }",A="stageChanges { field fromValue toValue changedAt createdSource changedBy { name } }",u="feeSharingAgreement feeSharingTerms partnerAgreementStatus internalOnly",H={client:{rootField:"client",document:`
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
          ${u} feedbackNotes
          createdAt updatedAt
          contacts { firstName lastName email }
          referredMandates { id name stage }
          referredTransactions { id name stage }
        }
      }
    `}};var J=`
  query ReferralPartnerDetail($id: ID!) {
    partner(id: $id) {
      id name partnerType status location organization email phone profile
      ${u} feedbackNotes
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
      ${A}
    }
  }
`,V=`
  query ReferralMandateStatus($id: ID!) {
    mandate(id: $id) {
      id name stage stageEnteredAt daysInStage dealStatus dealSize currency
      dateOpened createdAt updatedAt clientId
      client { id name }
      referredBy { id name partnerType status ${u} }
      transactions { id name stage dealStatus targetRaise currency partnerFeeStatus partnerFeeAmount }
      ${A}
    }
  }
`,Q=`
  query ReferralTransactionStatus($id: ID!) {
    transaction(id: $id) {
      id name stage stageEnteredAt dealStatus targetRaise currency
      partnerFeeStatus partnerFeeAmount
      dateOpened closedAt createdAt updatedAt clientId
      client { id name }
      referredBy { id name partnerType status ${u} }
      mandate {
        id name stage
        referredBy { id name partnerType status ${u} }
      }
      ${A}
    }
  }
`,w=`
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
      ${u} updatedAt
    }
  }
`,Z=`
  mutation ReferralUpdatePartner($id: ID!, $input: PartnerInput!) {
    updatePartner(id: $id, input: $input) {
      id name partnerType status organization email phone
      ${u} feedbackNotes updatedAt
    }
  }
`;function q(e){let n=[];for(let r of e){let s=new Set(r.referredMandates.map(t=>t.id));for(let t of r.referredMandates)n.push({dealKey:`mandate:${t.id}`,dealId:t.id,dealName:t.name,dealType:"mandate",partnerId:r.id,partnerName:r.name,stage:t.stage,dealStatus:t.dealStatus,link:`/mandates/${t.id}`,converted:t.stage==="Signed",lost:t.stage==="Lost",updatedAt:t.updatedAt});for(let t of r.referredTransactions)t.mandateId!=null&&s.has(t.mandateId)||n.push({dealKey:`transaction:${t.id}`,dealId:t.id,dealName:t.name,dealType:"transaction",partnerId:r.id,partnerName:r.name,stage:t.stage,dealStatus:t.dealStatus,link:`/transactions/${t.id}`,converted:t.stage==="ClosedWon",lost:t.stage==="ClosedLost",updatedAt:t.updatedAt})}return n}async function C(e){let n=await e.query(w);return q(n.partners)}function b(e){let n=new Date(Date.UTC(e.getUTCFullYear(),e.getUTCMonth(),e.getUTCDate())),r=n.getUTCDay();return n.setUTCDate(n.getUTCDate()-(r+6)%7),n.toISOString().slice(0,10)}var _="staff_users";var h="referral_stage_snapshots",N="referral_stage_notices";function S(e,n){return`${e.dealKey}:${e.stage}:${b(n)}`}async function K(e){let n=e.now?e.now():new Date,r=await e.scan(),s={scanned:r.length,seeded:0,unchanged:0,transitions:0,deduped:0,notified:0,notifyFailed:0,snapshotFailures:0},t=[],g=[],m=new Map;for(let a of r){let i;try{i=(await e.data.get(h,{dealKey:{$eq:a.dealKey}},1,1)).data[0]}catch{s.snapshotFailures+=1;continue}if(!i){g.push(a);continue}let R=i.id??i._id;R&&m.set(a.dealKey,R);let T=i.data?.stage,$=i.data?.dealStatus;if(T===a.stage&&$===a.dealStatus){s.unchanged+=1;continue}try{let D=S(a,n);if((await e.data.get(N,{noticeKey:{$eq:D}},1,1)).data.length>0){s.deduped+=1;continue}}catch{s.snapshotFailures+=1;continue}t.push({deal:a,fromStage:T??"(unknown)",fromDealStatus:$??"(unknown)"})}s.transitions=t.length;for(let a of g)try{await e.data.create(h,{dealKey:a.dealKey,partnerId:a.partnerId,partnerName:a.partnerName,dealName:a.dealName,stage:a.stage,dealStatus:a.dealStatus},`referral snapshot ${a.dealKey}`),s.seeded+=1}catch{s.snapshotFailures+=1}if(t.length===0)return s;let l=t.map(a=>{let i=a.deal.converted?" \u2014 converted! \u{1F389}":a.deal.lost?" \u2014 lost":"";return`\u2022 ${a.deal.dealName} (${a.deal.partnerName}): ${a.fromStage} \u2192 ${a.deal.stage}${i} ${e.baseUrl}${a.deal.link}`}).join(`
`),c=`\u{1F4C7} Referral watch \u2014 ${t.length} referred deal${t.length===1?"":"s"} moved:
${l}`,d=!1,x=await e.data.get(_,{},1,100),I=new Set;for(let a of x.data){let i=a.data?.userId;if(!(!i||I.has(i))){I.add(i);try{await e.send(i,c),s.notified+=1,d=!0}catch{s.notifyFailed+=1}}}if(!d)return s;for(let a of t)try{let i=m.get(a.deal.dealKey);i&&await e.data.update(h,i,{dealKey:a.deal.dealKey,partnerId:a.deal.partnerId,partnerName:a.deal.partnerName,dealName:a.deal.dealName,stage:a.deal.stage,dealStatus:a.deal.dealStatus}),await e.data.create(N,{noticeKey:S(a.deal,n),dealKey:a.deal.dealKey,toStage:a.deal.stage},`referral notice ${S(a.deal,n)}`)}catch{s.snapshotFailures+=1}return s}var v={name:"stage-watch",description:"Weekday 08:00 Nairobi sweep of referred deals: detects stage/status transitions since the last snapshot and sends registered staff one grouped update, flagging conversions and losses.",schedule:{type:"cron",expression:"0 8 * * 1-5",timezone:"Africa/Nairobi"},timeout:300,retry:{maxAttempts:3,backoffSeconds:120},execute:async()=>{let e=E();return K({scan:()=>C(e),data:{create:Data.create,get:Data.get,update:Data.update},send:(n,r)=>Channels.send({channel:"webchat",to:{userId:n},text:r}),baseUrl:e.baseUrl})}};var B={version:"2.0.0",kind:"job",name:"stage-watch",description:"Weekday 08:00 Nairobi sweep of referred deals: detects stage/status transitions since the last snapshot and sends registered staff one grouped update, flagging conversions and losses.",exportName:"stageWatchJob"},W={__lua_primitive__:B,primitive:v};
