# NobleStride CRM Meeting - Full Transcript (speaker-labeled)

_Auto-transcribed (Whisper large-v3-turbo) + voice diarization (sherpa-onnx). Speaker names inferred from voice + context - approximate._

Speaker map: **Solomon / Evans** = NobleStride; **Dave / Lua lead** = the vendor.

---

**[00:00-00:29] Solomon (NobleStride):**

Resilient like Nairobi or somewhere else? Yes, we work in Nairobi but we also have operations in Kenya not Kenya, I mean Tanzania and soon to be Uganda Oh, okay. Yeah, I've heard Nairobi is quite pleasant this time of year Yeah, it's not Sounds good Hi, Evans

**[00:30-00:42] Evans (NobleStride):**

Hi Thank you very much, I'm joining but I'm a bit on the road so I may not be very keen on following but I'll try to contribute from time to time when I'm needed

**[00:43-01:12] Lua lead/host:**

No worries, no worries Yeah, so, as you know, this meeting is to kind of like show you some updates on what we have built and ask for your opinions on that also had a few, Dave had a few questions on his end then we can also probably talk about a little bit about like what are the next steps that we are thinking of and yes, just to like keep everyone aligned on what is happening Dave, do you want to take that up now?

**[01:12-01:43] Dave (Lua):**

Sure, so I'll just share my screen and you know, we can start on whatever is being built So this is a version of the built CRM essentially this was to validate you know, the methods and everything that was provided how the data is going to look like, how things will be stored and be a basic front end wireframe with all the data areas that require storage

**[01:43-02:09] Lua lead/host:**

So guys, like this is something that we had been thinking about as a CRM tool for you guys so you know, we'll also be sharing this with you so of course you can give your opinions but I wanted to just like, Dave will go through like what all it entails what are the capabilities here and maybe you guys can give your opinions right now or maybe after testing it out yourselves, whatever works

**[02:09-03:10] Dave (Lua):**

Okay, so I'll just give a basic walkthrough of what each of these tabs do right, so essentially first of all we have our dashboard where we can just see all of our insights through the agent as well as through the metrics and visuals right, so what are our active mandates how many active transitions are going on, transactions are going on how many investors have engaged and so on and same way we will have a basic view of our pipeline and you know, again, these visuals can be tailored to whatever you guys need but essentially, these essentially provide a basic summary of whatever is going on then the next part we have is the mandate part right, so every different deal that's been going on everybody that's in the pipeline you can see it over here so a new lead, qualification, pitch presentation, etc, etc everything is present and of course these can go around as you like right, everything is, has a free movement and then again

**[03:10-04:05] Lua lead/host:**

So I think, guys, like what we wanted to do here was like the first thing dashboard is somewhere you can see like entire summary and then we wanted to get like layer by layer deeper into what is going on so mandates is like the overall, if I'm not wrong overall like life cycle of a deal from like making it from the lead to at the end like probably getting invested or closed whatever like stages we also like to like kind of want you guys to look at what are the different stages if you have kept it in a way that you guys work or would it be, or should it be kind of different so yeah, we have gone like layer by layer so dashboard was the overall summary then mandates is like at a deal level and then that will take you through like deeper levels on how we've gone through it but yeah, please go ahead

**[04:05-04:25] Dave (Lua):**

So every particular title has, you know, its own information about so for example StudyBody, right? so it has its own sector some basic information about it, recent activity and everything then we go to the transaction section and we can just check about how much how much deal is going in and out

**[04:25-04:40] Evans (NobleStride):**

yeah, like maybe just to check what's the preference? do we like write down the comments then we can give after or do we give the comments as we proceed? how do you prefer we go about it? so we can do both ways

**[04:40-04:55] Dave (Lua):**

essentially what we'll do is we'll share this link with you and you know, you can have a look and tell us your feedbacks and right now as well if you feel like you need to tell us something about to work on we can just note it down, right? yeah, okay

**[04:55-05:24] Evans (NobleStride):**

okay, so the D should like have a unique identifier for each of them yeah and in this case the unique identifier should be the project codename for example rather than just having a kill kids we should have maybe project ion kill kids or something like that and then that unique identifier is one that's going to leak the projects all through for example if we want to know the project a person is working on that unique identifier for each project is unique it's like the route towards everything else that will be associated with that particular company

**[05:24-05:46] Dave (Lua):**

yeah, so essentially what you're saying is a very good point and I thought about that so that's working in the backend, right? so you guys cannot see it but each of these projects have their own project ID as you mentioned but it's for the backend and for the AI agents to check maybe we can include it in the frontend sure, sure, I'll make it

**[05:46-05:48] Lua lead/host:**

but that's a very good point, yeah

**[05:48-05:49] Unclear / crosstalk:**

okay

**[05:49-06:18] Dave (Lua):**

got it so yeah, so essentially it already has what you're asking but we'll include it in frontend as well so okay then when you go on to that particular deal you see what are the investor engagements how the conversation is going on what has been the recent activity about it I guess my mic is echoing I guess my mic is echoing

**[06:18-06:25] Lua lead/host:**

I guess my mic is echoing Helen, it's Stevens coming from you, right? I'm from you, right?

**[06:28-06:37] Solomon (NobleStride):**

Evans I think there is an echo from that side or I don't know okay, okay let me put it on mute let me put it on mute

**[06:37-06:39] Unclear / crosstalk:**

alright

**[06:39-06:50] Dave (Lua):**

so yes, this was the transaction section so you get the overall idea and the basic wire framing is done for this part as well then we come

**[06:50-07:12] Lua lead/host:**

when we get to the transaction section we are getting like one level deeper, right? we are tracking what is the activity happening inside each deal on a mandate level we were tracking like where the deal is moving in stages and now under each stage as well we can see what are the different activities that are happening there so we have gone into a more deeper level in transactions

**[07:12-07:36] Dave (Lua):**

but yeah, go ahead so next would be investors investors again, they so investors part you can just add on whoever investors you have interacted with and you know what all areas are they interested in so for example this is a particular investor they are private equity they have agribusiness sectors geography etc etc so

**[07:36-07:37] Solomon (NobleStride):**

and this is well

**[07:37-07:49] Dave (Lua):**

their information as well so you can just check who has what information who to contact and what has been the recent activity with these investors as well so on the investors front guys we did not like brainstormed

**[07:49-08:32] Lua lead/host:**

but we were not able to kind of figure out like how exactly do you guys use investors data other than like investor matching so would love like your opinions on like even very small things like in this table if you want us to show more details any other columns or like you know probably some other features on how we can track investors or even just like how do you guys use investor database in general maybe we can build on top of that but this investor database I feel like can be improved a lot so I would like request you all to kind of try it out and do that and bring your opinions as well

**[08:32-09:08] Dave (Lua):**

and then we have two more sections first would be engagement right engagement basically mentions about all the communications for each project so if this is a particular project it is in series A what communications have been done etc etc right and then you can see an activity timeline as well so what happened when it happened with whom it happened all the data is available to you and all this data is essentially available through query as well from AI that part is not built yet but that's the idea you know presenting all this data yeah

**[09:08-09:45] Lua lead/host:**

I think here we can also like one of the ideas that I'm thinking of is like we can put in like filters at the top where we can see engagement by a project level we can see engagement by a team member level or maybe some other filters that we can put in for this even like maybe like what stage are we talking about that can be kept as a filter so possibly it can like give us that but yeah I think we can track engagement on a lot of different levels so yeah they've taken note of that and we should include that

**[09:45-10:21] Solomon (NobleStride):**

sure alright sorry just a quick thing on the engagement side there if you just click on one of it just go back let's go back so here on the engagement part for example if I can see Incofin have passed that I also get like a drop down or additional information on what they said about that or who I was communicating with or that one now goes links back to the transaction side where on that specific deal is where I can get the information from

**[10:21-10:34] Dave (Lua):**

so basically you need a map you need to map you know where this information came from and what happened in there right? yes got it got it

**[10:34-10:48] Lua lead/host:**

yeah let's include that yeah I think these are like small UX kind of feature additions that essentially like people would like as feedbacks from you but yeah that's good thanks alright

**[10:48-11:20] Dave (Lua):**

and then the last would be partners and these guys are essentially like who all are already in your database so I couldn't you know apart from mentioning who is already in here I couldn't figure out how in depth this has to be essentially right now if you check this one so you get to see who else is included and yeah that's about it so if you have any suggestions on how in depth you want this so we can work on that as well

**[11:20-11:59] Lua lead/host:**

yeah like we did not want to build everything we had a lot of ideas there but we did not want to build every single thing because we wanted to kind of get from you guys like how exactly you are looking at it so then we don't waste time building and then removing that so essentially that is why we build like an overall wireframe it has all the front end and back end developed into it first there are a lot of things to be done here but essentially like you can try it out use it it's based on the data points that you guys shared with us so very

**[11:59-12:54] Evans (NobleStride):**

very small yeah so from very small correction noble state is one word and the base should not be capital I know it's an error that has been carried off all the way from the contracting stage and Solomon I need you to pick this up okay so that we don't have this error into the system right it's a very small thing but so the name everything should be noble state capital because we have another we have other noble states we have other noble states so we should just be sure we are using noble state capital and the base is not capital and then on the partners maybe you can just try to give a bit of background in terms of what's the what was the intention maybe Solomon you can also try to explain that what was the intention in terms of what we wanted to achieve on these and what kind of partners are we looking at thanks Anissa

**[12:54-12:56] Unclear / crosstalk:**

got it okay

**[12:56-12:58] Lua lead/host:**

sorry go ahead

**[12:58-13:04] Dave (Lua):**

no I wanted maybe you can do it from your side first and then I can just be able to explain so that I also see yeah

**[13:04-13:21] Solomon (NobleStride):**

fairing line in terms of the build up what maybe you are looking at and then I can just maybe do a brief description in terms of the partners what we had projected or were expecting yeah okay makes sense

**[13:21-13:22] Unclear / crosstalk:**

so yeah

**[13:22-14:19] Lua lead/host:**

so when you guys will be sending you over this link when you guys tested think about it in two ways one is if it's able to solve like the current queries that you guys would want like whatever like even a small changes that you guys pointed out if you can look go deeper into a certain engagement that is happening right and also from the capability on how easy is it for you guys to add data here as much as you can so from both of these perspectives I think we have thought about it initially but also would love to have your feedbacks on it and of course like even if like we are already kind of improving it on day to day basis so we are working on it even as we speak so yeah that is how I would kind of pitch this to you guys

**[14:20-15:07] Dave (Lua):**

so there were certain questions that I had regarding you know up till now of whatever work we did so the requirements mentioned a prospecting stage right for our AI agent so I understand like prospecting essentially means you map you go and you know hunting out for investors and you know people to work with and all that so if I would get a deeper idea on like what exactly the prospecting should be about right so we could narrow down our search area and that would be helpful that would be the first question and second question I would have is the data hygiene that you know that is required so essentially if you try to add

**[15:07-15:24] Lua lead/host:**

maybe let's just go one by one on the prospect side I think the question if I'm not wrong is like who are we prospecting are we prospecting investors are we prospecting companies can you give us a little bit clearer idea about it

**[15:24-15:29] Unclear / crosstalk:**

okay so when it comes to prospects prospecting

**[15:29-17:56] Solomon (NobleStride):**

okay so when it comes to prospects prospecting is basically an opportunity or a company that which is going to be more or less going to form into a deal so this is a deal that now is going to have the three-way conversations like where you can be prospecting for one first of all it's a deal it's a deal this is a company that we are looking for and this is a company that is looking to either fundraise either through get to equity or it's just a company that is looking for a short-term assignment then on the other side if you also look at it internally once we have this opportunity we also do prospecting but then this prospecting is more or less about matching this opportunity to a potential investor for which this investor might be someone who is already within our database or it's an investor that is outside within our database where now we can be able to leverage something like an ai agent that can either check within our internal database and give us a recommendation in case it's there or if it's another investor who is maybe outside there with a different information an agent can also be able to get information from that so there are three ways to really look at it and uh the one thing that i also wanted to ask right now when we're looking at this here we're looking at it from an internal basis right right like it's us nobody's like we are seeing all of this information there's all of this information there is also that angle where we are building a hub where an investor can also be able to come in and access our opportunities or a partner can also be able to log into a portal more or less and access or share with us an opportunity which is a prospect or a deal that we can maybe pick up later on so if you are looking at it from that angle there are always three angles to look at it where internally we have an overview of all the things that are happening but you also have two views where it's an investor accessing our portal or our assistance get information on this that they want then there is also a partner who is as referred opportunities to us and they also want to have visibility in terms of how the status are progressing or the status of the deals that they have shared with us how they are progressing and what's not

**[17:56-18:46] Dave (Lua):**

so exactly on this point i had my next question um so so since we are building the crm right uh i wanted to know like what would be the scale of people who this will go out to right and based on and again as you mentioned like there are three ways to look at it like one from investors perspective one from the partners perspective and one from the admins perspective right so this is essentially the admins perspective where every everything is visible right so once we give this to you we would be able to you know uh like we would love to get that data on who should see what right if you're an investor what should you be able to see if you're a partner what should you be able to see we would love to know that information as well

**[18:46-19:12] Lua lead/host:**

but most of all if you can answer like within your internal team uh how many people are going to use it and do you need like some kind of uh uh blurry features between the team like some people can see some things and other people can see all of the things like some admin or a viewer or editor kind of roles or would it be like same for everyone who's going to use and how many people are going to use this

**[19:12-19:43] Solomon (NobleStride):**

okay so entirely should be used by everyone i believe we should have an admin role and i think that one we can be able to specify i'll just have a chat with the voice on that probably need to have admin because then you also need to have some bit of control in terms of deactivating users activating users and also things like limiting approvals so probably we have to define our user administration !

**[20:12-20:19] Lua lead/host:**

and then you also need to have a lot of people who will be managing their leads who will only have access to their own leads or their own data or their own engagements am i right?

**[20:19-20:25] Solomon (NobleStride):**

yes i was thinking from that approach or ever do you think differently?

**[20:25-22:32] Evans (NobleStride):**

yeah i think i think you're right we should have a bit of an admin role and also just the normal users because you need to look at this from um maybe uh a different angle in the company we have the senior management we have associates then we have maybe interns who will come in and they don't need to have a visibility maybe they need to have visibility on particular deals they're working on so access should not be the same for everybody there should be a bit of a level of access there should be someone who has admin rights to add to remove to give more rights to remove rights so there should be visibility different visibility different rights as uh suleman has mentioned and we are thinking that can that should actually come from your side you should be the ones guiding us on how we should have those levels of uh controls in the system because we will not be looking at um for example there's this question i asked about partners and i didn't get the answer what was your thinking about the partners so for example are the partners also gonna have access to this can we be able to track what is the partner has brought us and where we are with the partner for example if we have a partner that has brought us a deal i might want them to see where we are with that particular deal or if that's not something that the system can be able to do you can tell us ah okay that's the thing for the partners maybe you should we should not give them access to the rights maybe we should just monitor them on an exam or outside the system for the stimulus mainly for the employees of noble strategy capital i think that guidance you should give us because we might not be experts on that should you should tell us this is how best we think it should work and we pick it up so maybe just to go back to my other question on the partners what was the thinking here in terms of what are we trying to achieve on this witness all of this what we have built here is

**[22:32-23:03] Lua lead/host:**

just for you guys to track whatever is happening we did not keep like external any third party into the picture as of now of course we had talked about like the investor part not sure about the partners part like how investors can come in and see uh what are the deals that exist and if they want to come in and like kind of get information and maybe invest as well uh that is not something that we have looked at as of now as of now this is only for your internal usage so it's just about like you guys having a track of whatever is happening in the partner directory side of things

**[23:05-24:15] Evans (NobleStride):**

so are you able to explain to uh in terms of what is it that we intended to achieve or what you are the who manage the partners what is it that you require the system to have because the more information we give them and help them to understand the better we're going to get a good system yes but i think there's a bit of a broken telephone because uh we explained this to the team at lure that is uh mark and his colleagues but i don't think they have given you enough information on this so that is a bit of a broken telephone maybe someone would like us to have direct discussions with a team that's actually working on this particular project so that we give as much information as possible because we are making assumptions that they know what we intend to achieve but i suspect they don't have enough information in terms of what we're trying to achieve with this system and what we want to do yes maybe you can explain you can explain a bit on the partners that we have who are these partners what do they do for us what are we trying to achieve why are we trying to track them i think if they have that information they

**[24:15-25:10] Dave (Lua):**

will be able to give us some that makes sense sure so just just a little pointer to add um in here the whole partners uh screen that we're seeing basically is based on documentary centers and again it's not like total dummy data it's picked up from the files that you sent right and what i was trying to achieve like from an admin's perspective um if you if you have to understand like who are included in the partners what conversations you've had with them that all is included over here and the next point is like from if i'm a partner right i won't be seeing any of this i would have a completely different screen where i track my stuff so they're they're two separate things and currently we've built the one that you guys will see right not not the partners so that's a separate build process all together i would love to hear like

**[25:10-25:19] Lua lead/host:**

solomon explaining us what they exactly are sure sure so if i get it straight first of all we are only

**[25:19-32:16] Solomon (NobleStride):**

looking at an admin perspective this is the view that you're having is only noble strides view it's not an external view that has been built into this so in terms of partners we normally have these are people who might be in the same industry or people who might be in different industries within a law firm who also get opportunities or interact with companies that might be looking for funds so when this person normally reaches out to us they can be able to introduce this opportunity to us they can say we have company xyz that is actually looking to fundraise or maybe they're looking to raise one million in terms of debt once they do this for us we normally have to evaluate first of all an opportunity so this opportunity has to go through different stages first of all evaluate this opportunity the opportunity has to be qualified if it's an opportunity that matches our criteria by this point when i mean we are evaluating we sign an undisclosure agreement and we go through our whole process where we evaluate the financial statements and everything if this is an opportunity that actually qualifies or is something that we would work with within our mandate then we can be able to pick it up once we pick it up then we sign another agreement or another document which is called more or less like an engagement contract so when you have this engagement contract it's now a contract between us noble stripe and this opportunity or the company that has been introduced to us that one it's basically for our own internal purposes where in case we are doing our fundraising we specify all the details that we do what we are going to offer and also the fees that we are going to charge but if you also come back since we have qualified this opportunity this person who has introduced this opportunity to us we normally have an agreement or an arrangement that we work with them it's called a fee share agreement so a fee share agreement is basically just a revenue split where we are saying since this person introduced this opportunity to us if we successfully fundraise for this opportunity we are going to share the revenue with this person so up to this point all of those transactions of all of those processes that i've just briefly mentioned we need to be able to have visibility of all of them and that workflow needs to also be visible for us internally to be able to see and in case this person is we proceed with this opportunity and we are able to fundraise for this opportunity given that we have now those two contracts in place the fee share agreement with the partner where it specifies how much we are going to pay them if we successfully raise and also the engagement contract that also specifies the fees that we are going to get once we successfully fundraise for the target company we need to be able to track this in stages in case the displacement from from an investor has already happened at that stage because it can happen in different stages if you're maybe fundraising one million dollars you can find that maybe only 500 has been dispersed in the first phase there is another 500 that is going to be dispersed in the next phase so when that 500 is being dispersed you see there is now that clause that that contract that is saying we needed to pay this person we need to be able to see that for this investor for this partner this deal that they brought us and it was successful this amount has been dispersed and there is a payment that is supposed to be made to this partner from our side now and once that has happened in case the second displacement actually happens we need to also have that visibility within the system to be able to know the second displacement has happened this is the person who introduced this opportunity to us and we need to pay them that is now from our own side from that inside but if you also look at it there is also the other side of the partner side where this partner has introduced this opportunity for us to us to us they also need to be able to log in on a different view that's going to be a different ui view not this one internal where they see and they can be able to see they shared with us this deal yes we did evaluation of this deal and we have successfully onboarded this deal so they are fully aware yes we are going to progress on this deal and there is also an agreement or an arrangement where we have signed that issue agreement with them that if we successfully fundraise for this company we are going to pay them so if they log in and they see that the later on that we have been able to successfully fundraise for them they can also be able to know that yes this deal has been successful if it's a notification that has been sent to them they are quite aware that they will also be expecting some additional payment from our side to pay us because they introduced this opportunity to us so now that is just the person who is giving us that opportunity at the same time when they are logging in they should also be able to share additional opportunities with us so apart from them just logging in and seeing whatever they have shared with us there should also be a platform where they are now sharing these opportunities with us those opportunities end up being trapped within our crm but then they are also visible on their side so that communication does not break interesting yes and like when they define an opportunity what level of details do they put in so uh we shared some data it's going to be basic uh from whatever we had initially shared i think probably there's another file that uh have to follow up with a uh marco so that they also share that with you it's going to be the same files that we have we have this company it's in this sector this is how much they are looking to raise whether it's equity or debt and for us to also evaluate the opportunity we normally need the financial statements like uh three years of auditing financial statements maybe the company profile so it's a it's a whole package of information okay i believe marco should have shared that yes information list of what we normally provide what we require from uh from an opportunity for us to be able to evaluate it and be able to see if it's a fit within our mandate of the investors that we normally

**[32:16-33:09] Lua lead/host:**

work with okay i think then a lot of dots are getting connected from external parties as well and we need to kind of think about an infra that can handle all of this so definitely we can we can of course like everything is possible so we're going to work on that uh cool uh i think the next steps would be to see how the partner thing as well as the investor uh third party thing can work uh both in terms of architecture as well as like how does the experience feel like not in terms of like exactly like visual but what kind of information are they able to see and how can we control that information from our and how do we not share any kind of internal information with them that is not supposed to but anyway yeah i think we can definitely work on that cool uh if you had i think other questions

**[33:09-33:22] Dave (Lua):**

as well right yeah the other two questions included about um you know data hygiene as to the the files that are shared some of them have some areas missing so since like their data that's already been saved

**[33:22-34:27] Solomon (NobleStride):**

in your system how do we handle that okay uh you have mentioned that some data might be missing well i think uh when when the data migration is happening you can just highlight these areas that you feel might be missing in case those fields are mandatory it's fine we can always be able to evaluate that data and you can be able to also engage with the investors because i believe from our side all the data that we are sharing if it's for the investors it's for the client or if it's for the partner we have their contacts we can be able to provide and maybe some of them who might not even necessarily need to migrate with them based on how we evaluate so we will be able to evaluate that data it's going to be part of the process and you can be able to share with us the data that you actually feel might be more or less like a mandatory field and it's missing and you might need to be able to feel that i that that one you can't be able to assist with that it's not a problem okay so we work

**[34:27-34:39] Lua lead/host:**

alongside uh the hygiene of the data yes anything else that would be all for my time sorry solomon

**[34:39-35:34] Solomon (NobleStride):**

where you say something uh okay i just uh i just wanted to check in terms of in terms of the files in case uh maco has shared some file because we had some file that we shared that has a breakdown of additional descriptions or scope of whatever we wanted in case maybe something is not clear it's fine you can be able to just let us know and we can be able to assist in terms of clarification on that side yeah and uh also you mentioned something about sharing access to this so you can be able to do that later on and we can also be able to just browse in and see what you have done from that side and also be able to give it some additional feedback in terms of what was the expectation or what can also be able to be improved yeah that would actually be very awesome yeah so we will share this with you and

**[35:35-36:59] Lua lead/host:**

on the first part we did already go through the docs that marco shared with us i think there were around 10 or 12 excel files that we had to go through so yeah i think all of the files that you shared with marco he shared with us as well uh cool uh i think on the next steps of course we're gonna work on this part uh first like understanding how the entire like structure would look like in terms of both like the technical side of instrument and back end including third party systems like investor and also partners but also we're gonna think about how the infra would look like on the agent side uh especially these prospects prospecting as well as investor matching because this seems to be quite uh interesting and uh i think essentially data heavy as well so uh that is what our next steps look like we'll keep you updated and yeah we'll share with this with you let us know what your opinions are and for of course uh uh they they can you also like mention so after this we'll be sending an email they've do send an email i'll mention all of the changes that were proposed today so that uh we are updated on like already the proposed changes so that we don't like propose it again and again yeah sure definitely uh that's that work for you guys uh anything else you guys want to point out or talk about

**[37:03-37:09] Solomon (NobleStride):**

okay i think uh that's definitely clear i think from my side it's more or less going to follow up on

**[37:09-37:16] Unclear / crosstalk:**

the documents that you have shared the scope and also getting access to that uh demo database so that

**[37:16-37:43] Solomon (NobleStride):**

i can be able to have a look at it and also try to tie up on the broken part because i think there is there is some missing part in terms of what we had defined in terms of scope for the build and maybe what would have been shared uh with you guys so if we can be able to tie up on that probably we'll be be able to move faster and be able to get uh the final product up and learn some better we'll have a

**[37:43-38:08] Evans (NobleStride):**

chat with my master do you do you have access to do you have access to the scope of work between noble city capital and lure yep yep that is what we build on okay and among the excel documents that uh marco shared there was a word document that was a bit detailed i don't know whether you had a chat look

**[38:08-38:16] Lua lead/host:**

at it not like maybe 10 or 20 pages okay thanks for letting us know that we will we'll see what we

**[38:16-38:21] Dave (Lua):**

can find out the the document that contain essentially data fields that were required right

**[38:24-38:46] Evans (NobleStride):**

no i'm asking this among the documents that uh marco shared there was some document that was a word document that was a word document that had sort of a uh password i don't know that he shared that with you or you are not aware about it because it has like 10 pages of just the thought process of how we wanted the crm to be and how it should look any chance you had an opportunity to look

**[38:46-39:31] Lua lead/host:**

at that okay cool i think uh we will uh see if marco has shared that with us and if not we're gonna definitely ask for this i think this would be very helpful for us to understand it deeply we'll also have a chat with marco and understand like what exactly are you guys expecting because we were working on the top of scope of work and from there on we are taking on and building this but yeah we'll have it we'll do all of that sure all right guys uh if you guys don't have anything i think we can go ahead uh uh and close call uh but yeah uh sorry i think maybe i might have been speaking while i was on mute

**[39:31-39:36] Evans (NobleStride):**

i had asked whether you got access to our document that was like 20 pages did you get it

**[39:37-39:50] Dave (Lua):**

can you check yeah i just just give me a second there were like one big document that was initially shared which had all the data fields and everything about what was required in the crm are you talking

**[39:50-40:01] Evans (NobleStride):**

about that that let me just check if i can be able to get the name let me just check if i can be able

**[40:01-40:41] Dave (Lua):**

to get the name for that document sure so we have like we have noble stride lua phase one context we have lua x noble stride build specifications and we have phase one client sw right these are the pdf documents and other than that were the shared files that were exactly that were exactly so i have one two three four five document files and three excel sheets yeah these are the ones that we

**[40:41-41:11] Lua lead/host:**

have so he shared the password with us as well but we have like a few excel files which shows like the crm data active deals and crm tracker and all of that uh there are some pdfs uh concept not for automating which is talking inside which one are you guys talking about okay i'll try to see if uh i'll try to

**[41:11-41:16] Evans (NobleStride):**

see if i can get the document and then i'll forward it to you an email oh that would be great yeah

**[41:17-41:24] Solomon (NobleStride):**

oh that would be great awesome uh thanks thanks

**[41:28-41:55] Lua lead/host:**

nothing from my side cool yeah uh looking forward to kind of updating you guys on this and yeah let us know your feedbacks as well uh love to have that uh love to have that okay all right thanks guys

**[41:55-42:02] Unclear / crosstalk:**

um
