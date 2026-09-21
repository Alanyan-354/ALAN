import type { Database, Entity } from '../../lib/types';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const iso = (offset: number) => new Date(Date.now() + offset).toISOString();
export const demoIdentities = { admin: id(1), student: id(2), moderator: id(3), outsider: id(4), duke: id(11) };

export function createSeed(empty = false): Database {
  const now=iso(-3_600_000);
  const accountMeta={created_at:now,updated_at:now,last_sign_in_at:now,review_count:0,response_count:0,submission_count:0};
  const accounts: Database['accounts'] = [
    { ...accountMeta,id:id(1), email:'admin@example.edu', nickname:'Campus Admin', role:'admin', suspended:false, verified:true },
    { ...accountMeta,id:id(2), email:'student@example.edu', nickname:'Alex on campus', role:'user', suspended:false, verified:true },
    { ...accountMeta,id:id(3), email:'moderator@example.edu', nickname:'Campus Moderator', role:'moderator', suspended:false, verified:true },
    { ...accountMeta,id:id(4), email:'student@elsewhere.edu', nickname:'Visiting Student', role:'user', suspended:false, verified:true },
    ...['Jamie','Taylor','Morgan','Riley','Sam','Casey'].map((nickname,i)=>({...accountMeta,id:id(5+i),email:`student${i}@example.edu`,nickname,role:'user' as const,suspended:false,verified:true})),
    { ...accountMeta,id:id(11), email:'student@duke.edu', nickname:'Cameron Student', role:'user', suspended:false, verified:true },
    ...['Avery','Jordan','Skyler','Quinn','Devon','Reese','Parker','Drew'].map((nickname,i)=>({...accountMeta,id:id(12+i),email:`demo${i+1}@duke.edu`,nickname,role:'user' as const,suspended:false,verified:true})),
  ];
  const db: Database = { schools:[], categories:[], entities:[], dimensions:[], accounts, reviews:[], values:[], reports:[], audit:[], limits:[], questions:[], question_options:[], question_responses:[], submissions:[],forum_editorial_identities:[],forum_posts:[],forum_post_images:[],forum_comments:[],forum_post_likes:[] };
  if (empty) return db;

  db.schools = [
    {id:id(20),name:'Example University',slug:'example-university',email_domain:'example.edu',city:'Brookfield',state:'North Carolina',country:'United States',status:'active'},
    {id:id(21),name:'Duke University',slug:'duke-university',email_domain:'duke.edu',city:'Durham',state:'North Carolina',country:'United States',status:'active'},
  ];
  db.categories = [
    ['Dining','dining','Find your next favorite bite.','utensils'],
    ['Study spaces','study-spaces','A little space to focus.','book'],
    ['Housing','housing','Find a place to feel at home.','home'],
    ['Campus life','campus-life','Make more of your time here.','sparkles'],
  ].map(([name,slug,description,icon],i)=>({id:id(30+i),school_id:id(20),name,slug,description,icon,status:'active' as const,sort_order:i+1,is_discover_default:false,accepts_submissions:false}));
  db.categories.push({id:id(34),school_id:id(20),name:'Community',slug:'community',description:'Student-submitted campus finds, reviewed before publication.',icon:'sparkles',status:'active',sort_order:0,is_discover_default:true,accepts_submissions:true});
  const dimensionSets = [
    [['taste','Taste'],['value','Meal Plan Value'],['service','Service']],
    [['quietness','Quietness'],['comfort','Comfort'],['availability','Availability']],
    [['comfort','Comfort'],['location','Location'],['facilities','Facilities']],
    [['experience','Experience'],['accessibility','Accessibility'],['value','Value']],
  ];
  db.dimensions = dimensionSets.flatMap((dimensions,i)=>dimensions.map(([key,label],j)=>({id:id(50+i*3+j),category_id:id(30+i),key,label,description:'',min_value:1,max_value:10,sort_order:j,is_required:true,is_active:true})));
  const resources = [
    ['The Commons Kitchen','the-commons-kitchen',0,'Central Campus','Fresh lunches, familiar faces.','A bright campus gathering spot with rotating daily plates, warm sandwiches and plenty of room to catch up with friends.'],
    ['North Reading Room','north-reading-room',1,'North Campus','For your next deep-focus session.','A quiet room with individual desks, generous natural light and power outlets close at hand.'],
    ['Cedar Hall','cedar-hall',2,'West Campus','A comfortable place to land.','A residential community with shared kitchens, common lounges and easy access to the center of campus.'],
    ['Student Garden','student-garden',3,'East Campus','Take a little breather.','An open-air space for a quiet break, a walk with friends or a few pages between classes.'],
    ['Bluebird Café','bluebird-cafe',0,'Central Campus','Coffee and a good conversation.','A small café serving coffee, tea and light bites inside the campus commons.'],
    ['The Workshop','the-workshop',1,'East Campus','Room for ideas to take shape.','A collaborative workspace with group tables, whiteboards and bookable project areas.'],
  ];
  db.entities = resources.map((r,i)=>({id:id(100+i),school_id:id(20),category_id:id(30+Number(r[2])),parent_entity_id:i===4?id(100):null,name:String(r[0]),slug:String(r[1]),short_description:String(r[4]),description:String(r[5]),location_name:String(r[3]),address:'',latitude:null,longitude:null,official_url:'',source_name:'Fictional demonstration record',source_url:'',last_verified_at:null,metadata:i===1?{amenities:['Power outlets','Individual desks'],environment:'Quiet study'}:i===2?{amenities:['Shared kitchen','Laundry','Lounge']}:{amenities:['Wi-Fi','Seating']},status:'active',is_featured:i<3,created_at:'2026-09-01T12:00:00Z'} as Entity));
  const bodies = ['A solid go-to between classes. The space is welcoming and it is easy to find your way around.','One of my favorite spots on campus. A little busier in the afternoon, so plan ahead.','Really useful to have nearby. I have had a consistently good experience here.','Worth a visit! Comfortable, convenient and a nice change of pace.'];
  db.entities.forEach((entity,i)=>{for(let j=0;j<4;j++){const reviewId=id(200+i*10+j);const score=[10,10,8,8][(i+j)%4];db.reviews.push({id:reviewId,entity_id:entity.id,user_id:id(5+j),overall_rating:score,body:bodies[(i+j)%4],is_anonymous:j%2===0,status:'published',created_at:`2026-09-${String(10+j).padStart(2,'0')}T12:00:00Z`,updated_at:'2026-09-14T12:00:00Z'});db.dimensions.filter(d=>d.category_id===entity.category_id).forEach((d,k)=>db.values.push({review_id:reviewId,rating_dimension_id:d.id,score:k===1?8:score}));}});

  seedDukeDiscover(db);
  seedPulse(db);
  seedForum(db);
  return db;
}

function seedDukeDiscover(db:Database){
  const school=id(21);
  const categories=[
    {id:id(35),school_id:school,name:'Dining',slug:'dining',description:'Dining halls, cafes and individual food stations.',icon:'utensils',status:'active' as const,sort_order:0,is_discover_default:true,accepts_submissions:false},
    {id:id(36),school_id:school,name:'Housing',slug:'housing',description:'Residential campuses, quads, houses and buildings.',icon:'home',status:'active' as const,sort_order:1,is_discover_default:false,accepts_submissions:false},
  ];
  db.categories.push(...categories);
  const dimensions=[
    [62,35,'taste','Taste','Quality and consistency of the food.'],[63,35,'value','Meal Plan Value','Value relative to price or meal-plan cost.'],[64,35,'wait-time','Wait time','How manageable the wait usually is.'],
    [65,36,'comfort','Comfort','Day-to-day comfort of the residence.'],[66,36,'location','Location','Convenience of the campus location.'],[67,36,'facilities','Facilities','Quality and usefulness of shared facilities.'],
  ] as const;
  db.dimensions.push(...dimensions.map(([n,category,key,label,description],sort_order)=>({id:id(n),category_id:id(category),key,label,description,min_value:1,max_value:10,sort_order:sort_order%3,is_required:true,is_active:true})));
  const listings=[
    ["Brodhead Center","brodhead-center","dining",null,"Brodhead Center",true],
    ["Bryan Center","bryan-center","dining",null,"Bryan Center",true],
    ["Marketplace","marketplace","dining",null,"Marketplace",true],
    ["Trinity Cafe","trinity-cafe","dining",null,"Duke University",false],
    ["Café 300","cafe-300","dining",null,"Duke University",false],
    ["Freeman Center Cafe","freeman-center-cafe","dining",null,"Duke University",false],
    ["Nasher Cafe","nasher-cafe","dining",null,"Duke University",false],
    ["Garden's Cafe","gardens-cafe","dining",null,"Duke University",false],
    ["Bella Union","bella-union","dining",null,"Duke University",false],
    ["Pitchfork's","pitchforks","dining",null,"Duke University",false],
    ["The Daily Docket","the-daily-docket","dining",null,"Duke University",false],
    ["Red Mango","red-mango","dining",null,"Duke University",false],
    ["Saladelia at Sanford","saladelia-at-sanford","dining",null,"Duke University",false],
    ["Saladelia at Perkins Library","saladelia-at-perkins-library","dining",null,"Duke University",false],
    ["Twinnie's","twinnies","dining",null,"Duke University",false],
    ["Zweli's","zwelis","dining",null,"Duke University",false],
    ["Bseisu Coffee Bar","bseisu-coffee-bar","dining",null,"Duke University",false],
    ["East Campus","east-campus","housing",null,"East Campus",false],
    ["West Campus","west-campus","housing",null,"West Campus",false],
    ["Cafe","brodhead-center-cafe","dining","brodhead-center","Brodhead Center",false],
    ["Farmstead","farmstead","dining","brodhead-center","Brodhead Center",false],
    ["Ginger + Soy","ginger-soy","dining","brodhead-center","Brodhead Center",false],
    ["Gyotaku","gyotaku","dining","brodhead-center","Brodhead Center",false],
    ["Il Forno","il-forno","dining","brodhead-center","Brodhead Center",false],
    ["JB's Roasts & Chops","jbs-roasts-and-chops","dining","brodhead-center","Brodhead Center",false],
    ["Panera Bread","panera-bread","dining","brodhead-center","Brodhead Center",false],
    ["Sazón","sazon","dining","brodhead-center","Brodhead Center",false],
    ["Sprout","sprout","dining","brodhead-center","Brodhead Center",false],
    ["Tandoor","tandoor","dining","brodhead-center","Brodhead Center",false],
    ["The Chef's Kitchen","the-chefs-kitchen","dining","brodhead-center","Brodhead Center",false],
    ["The Commons","the-commons","dining","brodhead-center","Brodhead Center",false],
    ["The Devil's Krafthouse","the-devils-krafthouse","dining","brodhead-center","Brodhead Center",false],
    ["The Skillet","the-skillet","dining","brodhead-center","Brodhead Center",false],
    ["The Sub Central","the-sub-central","dining","brodhead-center","Brodhead Center",false],
    ["Beyu Blue Coffee","beyu-blue-coffee","dining","bryan-center","Bryan Center",false],
    ["Gothic Grill","gothic-grill","dining","bryan-center","Bryan Center",false],
    ["It's Thyme","its-thyme","dining","bryan-center","Bryan Center",false],
    ["McDonald's","mcdonalds","dining","bryan-center","Bryan Center",false],
    ["Wood-Fired","marketplace-wood-fired","dining","marketplace","Marketplace",false],
    ["Cucina","marketplace-cucina","dining","marketplace","Marketplace",false],
    ["Harvest","marketplace-harvest","dining","marketplace","Marketplace",false],
    ["Fusion","marketplace-fusion","dining","marketplace","Marketplace",false],
    ["Durham Market","durham-market","dining","marketplace","Marketplace",false],
    ["1892 Grille","1892-grille","dining","marketplace","Marketplace",false],
    ["Leaf & Ladle","leaf-and-ladle","dining","marketplace","Marketplace",false],
    ["Baker's Table","bakers-table","dining","marketplace","Marketplace",false],
    ["Alspaugh","alspaugh","housing","east-campus","East Campus",false],
    ["Bassett","bassett","housing","east-campus","East Campus",false],
    ["Bell Tower","bell-tower","housing","east-campus","East Campus",false],
    ["Blackwell","blackwell","housing","east-campus","East Campus",false],
    ["Brown","brown","housing","east-campus","East Campus",false],
    ["East House","east-house","housing","east-campus","East Campus",false],
    ["Gilbert-Addoms","gilbert-addoms","housing","east-campus","East Campus",false],
    ["Giles","giles","housing","east-campus","East Campus",false],
    ["Pegram","pegram","housing","east-campus","East Campus",false],
    ["Randolph","randolph","housing","east-campus","East Campus",false],
    ["Southgate","southgate","housing","east-campus","East Campus",false],
    ["Trinity","trinity","housing","east-campus","East Campus",false],
    ["West House","west-house","housing","east-campus","East Campus",false],
    ["Wilson","wilson","housing","east-campus","East Campus",false],
    ["Craven Quad","craven-quad","housing","west-campus","West Campus",false],
    ["Crowell Quad","crowell-quad","housing","west-campus","West Campus",false],
    ["Edens Quad","edens-quad","housing","west-campus","West Campus",false],
    ["Few Quad","few-quad","housing","west-campus","West Campus",false],
    ["Hollows Quad","hollows-quad","housing","west-campus","West Campus",false],
    ["Keohane Quad","keohane-quad","housing","west-campus","West Campus",false],
    ["Kilgo Quad","kilgo-quad","housing","west-campus","West Campus",false],
    ["Wannamaker Quad","wannamaker-quad","housing","west-campus","West Campus",false],
    ["Alchemy","alchemy","dining","gothic-grill","Gothic Grill at Bryan Center",false],
    ["Edens 1A","edens-1a","housing","edens-quad","Edens Quad",false],
    ["Edens 1B","edens-1b","housing","edens-quad","Edens Quad",false],
    ["Edens 1C","edens-1c","housing","edens-quad","Edens Quad",false],
    ["Edens 2A","edens-2a","housing","edens-quad","Edens Quad",false],
    ["Edens 2C","edens-2c","housing","edens-quad","Edens Quad",false],
    ["Edens 3A","edens-3a","housing","edens-quad","Edens Quad",false],
    ["Edens 3B","edens-3b","housing","edens-quad","Edens Quad",false],
    ["Hollows A","hollows-a","housing","hollows-quad","Hollows Quad",false],
    ["Hollows B","hollows-b","housing","hollows-quad","Hollows Quad",false],
    ["Keohane ABD","keohane-abd","housing","keohane-quad","Keohane Quad",false],
    ["Keohane E","keohane-e","housing","keohane-quad","Keohane Quad",false],
  ] as const;
  listings.forEach(([name,slug,category,parent,location,featured],index)=>{
    const entityId=id(1000+index),categoryId=id(category==='dining'?35:36),parentIndex=parent?listings.findIndex(item=>item[1]===parent):-1;
    db.entities.push({id:entityId,school_id:school,category_id:categoryId,parent_entity_id:parentIndex>=0?id(1000+parentIndex):null,name,slug,short_description:category==='dining'?'A Duke dining location.':'A Duke housing location.',description:category==='dining'?'A dining location in the Duke campus demo catalog.':'A residential location in the Duke campus demo catalog.',location_name:location,address:'',latitude:null,longitude:null,official_url:'',source_name:'Fictional demonstration record',source_url:'',last_verified_at:null,metadata:{amenities:category==='dining'?['Campus dining','Seating']:['Shared spaces','Campus access']},status:'active',is_featured:featured,created_at:'2026-09-01T12:00:00Z'});
    const scores=[8,9,7,10];
    scores.forEach((score,reviewIndex)=>{const reviewId=id(2000+index*4+reviewIndex);db.reviews.push({id:reviewId,entity_id:entityId,user_id:id(12+reviewIndex),overall_rating:score,body:['Reliable between classes and easy to navigate.','A campus favorite with a consistently good experience.','Useful to have nearby, especially on a busy day.','One of the places I recommend to other students.'][reviewIndex],is_anonymous:reviewIndex%2===0,status:'published',created_at:`2026-09-${String(10+reviewIndex).padStart(2,'0')}T15:00:00Z`,updated_at:'2026-09-14T15:00:00Z'});db.dimensions.filter(d=>d.category_id===categoryId).forEach((dimension,dimensionIndex)=>db.values.push({review_id:reviewId,rating_dimension_id:dimension.id,score:Math.max(1,score-(dimensionIndex===2?1:0))}));});
  });
}

function seedForum(db:Database){
  const team=id(600),contributor=id(601),school=id(21);
  db.forum_editorial_identities.push(
    {id:team,name:'RATEDUKE Campus Team',seeded:true,created_at:iso(-30*86400000)},
    {id:contributor,name:'Campus Contributor',seeded:true,created_at:iso(-30*86400000)}
  );
  const posts=[
    ['Perkins or Bostock? A quiet-seat field guide','A practical walk-through of the study environments students tend to look for: natural light, nearby outlets, conversation level, and how each floor feels at different points in a study session.',-3,[1,2,3]],
    ['An unhurried East Campus morning','A small visual diary of brick paths, shaded benches, and the kind of ten-minute pause that makes a full class day feel more manageable.',-8,[4,5]],
    ['Brodhead lunch: build a calmer route','A simple way to approach a busy lunch window: decide before you arrive, keep the circulation lanes clear, and take your meal outside when the weather is comfortable.',-14,[6,7]],
    ['A slow loop through Duke Gardens','A gentle study-break route built around paths, water, leaves, and a place to sit. Keep shared spaces quiet and leave every corner as you found it.',-20,[8,9]],
    ['Cameron game-day essentials, minus the rush','A checklist of ordinary things that make a crowded campus event easier: water, a light layer, a clear meeting point, and a plan for getting home.',-27,[10,11]],
    ['West Campus light: when the stone feels warm','Late afternoon brings out texture in arches, steps, and trees. These are general photo notes, not a promise of a particular weather or event window.',-36,[12,13]],
    ['Three small habits for an easier campus commute','Leave a buffer, check the next connection before walking away, and keep one backup route in mind. The best commute is usually the one with fewer decisions.',-48,[14]],
    ['A Durham study-break route for a reset','Books, coffee, a short walk, and a quiet corner: a generic off-campus reset built around slowing down rather than checking off destinations.',-62,[15,16]],
  ] as const;
  posts.forEach(([title,body,hours,images],index)=>{
    const postId=id(610+index);const created=iso(hours*3600000);const imageIds=images.map((_,imageIndex)=>id(700+index*4+imageIndex));
    db.forum_posts.push({id:postId,school_id:school,author_user_id:null,editorial_identity_id:team,title,body,status:'published',cover_image_id:imageIds[0],created_at:created,updated_at:created,published_at:created,deleted_at:null});
    images.forEach((asset,imageIndex)=>db.forum_post_images.push({id:imageIds[imageIndex],post_id:postId,storage_path:null,bundled_path:`/forum-seed/${String(asset).padStart(2,'0')}.webp`,sort_order:imageIndex,width:imageIndex%2?1200:1000,height:imageIndex%2?1000:1320,status:'ready',created_at:created}));
  });
  const comments:[number,number|null,string,string,number][]=[
    [800,null,'The quiet morning pace is the detail I always forget to protect. 🌤️', 'contributor',-2.6],[801,800,'Same here — ten minutes on a bench changes the whole day.', 'team',-2.4],[802,801,'And leaving the phone in my bag helps more than expected 😅','contributor',-2.2],[803,802,'A small reset before class is genuinely useful.','team',-2.0],
    [804,null,'Bostock feels better for group work; Perkins is my reset zone.','contributor',-2.1],[805,null,'This is the exact level of detail I wanted before finals week. 📚','contributor',-1.8],
    [806,null,'East Campus mornings have such a different pace.','contributor',-7.1],[807,806,'The shaded benches are an underrated ten-minute break. 🌿','team',-6.8],[808,null,'A small walk before class genuinely helps.','contributor',-6.3],
    [809,null,'Choosing before entering is the best lunch advice.','contributor',-13.4],[810,809,'It also keeps the line moving for everyone.','team',-13.1],[811,810,'Team “find a seat second, food first” 🙌','contributor',-12.8],[812,null,'Taking lunch outside makes the whole day feel less rushed.','contributor',-12.2],
    [813,null,'The reminder to leave shared spaces as we found them matters.','contributor',-19.0],[814,813,'Absolutely. Quiet paths work because people care for them.','team',-18.7],[815,null,'A slow loop is perfect after a long reading block. 🌱','contributor',-18.1],
    [816,null,'A clear meeting point is the real game-day life hack.','contributor',-25.8],[817,816,'Especially when everyone’s phone is low on battery.','team',-25.4],[818,817,'Portable charger: promoted to essential status 🔋','contributor',-25.1],[819,null,'The light-layer reminder is so real.','contributor',-24.6],
    [820,null,'Late afternoon texture on the stone is beautiful. 📷','contributor',-34.9],[821,820,'And the softer contrast is much easier to photograph.','team',-34.5],[822,null,'Thanks for avoiding a “secret exact time” claim — weather changes everything.','contributor',-33.8],
    [823,null,'The backup-route habit lowers my stress immediately.','contributor',-46.7],[824,null,'Fewer decisions is exactly the goal. 🚌','contributor',-45.9],
    [825,null,'Books + coffee + a short walk is my ideal reset. ☕','contributor',-60.2],[826,825,'Same — the route matters less than actually taking the break.','team',-59.8]
  ];
  const postFor=(n:number)=>n<804?611:n<806?610:n<809?611:n<813?612:n<816?613:n<820?614:n<823?615:n<825?616:617;
  for(const [n,parent,body,who,hours] of comments){const created=iso(hours*3600000);db.forum_comments.push({id:id(n),post_id:id(postFor(n)),parent_comment_id:parent===null?null:id(parent),author_user_id:null,editorial_identity_id:who==='team'?team:contributor,body,status:'published',created_at:created,updated_at:created,deleted_at:null});}
}

function seedPulse(db: Database) {
  const questionData = [
    {n:400,type:'prediction' as const,title:'Will Duke win its next basketball matchup against UNC?',category:'Basketball',status:'open' as const,closes:7,event:8,result:null,popup:true,featured:true,labels:['Yes','No']},
    {n:401,type:'prediction' as const,title:'Which team will place higher at the next student engineering competition?',category:'Student teams',status:'open' as const,closes:12,event:14,result:null,popup:true,featured:false,labels:['Duke Motorsports','Duke EV']},
    {n:402,type:'prediction' as const,title:'Did Durham see measurable snow during the forecast window?',category:'Durham weather',status:'resolved' as const,closes:-20,event:-18,result:0,popup:false,featured:false,labels:['Yes','No']},
    {n:403,type:'poll' as const,title:'Which computer do you use most for coursework?',category:'Technology',status:'open' as const,closes:null,event:null,result:null,popup:true,featured:true,labels:['Mac','Windows','Other']},
    {n:404,type:'poll' as const,title:'Which side of campus do you prefer spending time on?',category:'Campus life',status:'closed' as const,closes:-2,event:null,result:null,popup:false,featured:true,labels:['East Campus','West Campus']},
    {n:405,type:'poll' as const,title:'Where do you study most often?',category:'Study habits',status:'closed' as const,closes:-1,event:null,result:null,popup:false,featured:true,labels:['Perkins / Bostock','Dorm or apartment','Other campus space','Off campus']},
    {n:406,type:'poll' as const,title:'Which dining location do you visit most often?',category:'Dining',status:'open' as const,closes:null,event:null,result:null,popup:true,featured:false,labels:['Brodhead Center','Marketplace','Pitchfork’s','Other']},
  ];
  questionData.forEach((q,index)=>{
    const qid=id(q.n);const optionIds=q.labels.map((_,i)=>id(410+index*5+i));
    db.questions.push({id:qid,school_id:id(21),type:q.type,title:q.title,category:q.category,status:q.status,closes_at:q.closes===null?null:iso(q.closes*86400000),event_at:q.event===null?null:iso(q.event*86400000),resolved_option_id:q.result===null?null:optionIds[q.result],show_in_popup:q.popup,is_featured:q.featured,sort_order:index,created_by:id(1),created_at:iso(-30*86400000),updated_at:iso(-86400000)});
    q.labels.forEach((label,i)=>db.question_options.push({id:optionIds[i],question_id:qid,label,sort_order:i}));
  });
  const choices:Record<number,number[]>={400:[0,0,1,0,0,1],401:[0,1,0,0,1],402:[0,1,0,0,0,1,0],403:[0,0,1,0,2,0,1,0],404:[1,0,0,1,1,0,1,0],405:[0,0,1,0,2,0,3,0],406:[0,1,0,2,3]};
  Object.entries(choices).forEach(([number,answers])=>{const qid=id(Number(number));const options=db.question_options.filter(o=>o.question_id===qid).sort((a,b)=>a.sort_order-b.sort_order);answers.forEach((choice,i)=>db.question_responses.push({question_id:qid,option_id:options[choice].id,user_id:id(12+i),created_at:iso(-(i+2)*3600000),updated_at:iso(-(i+1)*3600000)}));});
  const mac=db.question_options.find(o=>o.question_id===id(403)&&o.label==='Mac')!;
  db.question_responses.push({question_id:id(403),option_id:mac.id,user_id:id(11),created_at:iso(-3600000),updated_at:iso(-3600000)});
}

export function upgradeDemo(input: Partial<Database>): Database {
  const base=createSeed();
  const db={...input,questions:input.questions||[],question_options:input.question_options||[],question_responses:input.question_responses||[],submissions:input.submissions||[],forum_editorial_identities:input.forum_editorial_identities||[],forum_posts:input.forum_posts||[],forum_post_images:input.forum_post_images||[],forum_comments:input.forum_comments||[],forum_post_likes:input.forum_post_likes||[]} as Database;
  if(!db.schools?.length)return {...db,schools:[],categories:[],entities:[],dimensions:[],reviews:[],values:[],reports:[],audit:[],questions:[],question_options:[],question_responses:[],submissions:[],forum_editorial_identities:[],forum_posts:[],forum_post_images:[],forum_comments:[],forum_post_likes:[]};
  const diningCategoryIds=new Set(db.categories.filter(category=>category.slug==='dining').map(category=>category.id));
  for(const dimension of db.dimensions)if(diningCategoryIds.has(dimension.category_id)&&dimension.key==='value')dimension.label='Meal Plan Value';
  const dukeId=id(21);const addUnique=<T extends {id?:string}>(target:T[],source:T[])=>{for(const item of source)if(!item.id||!target.some(x=>x.id===item.id))target.push(item);};
  addUnique(db.accounts,base.accounts.filter(a=>a.email.endsWith('@duke.edu')));
  addUnique(db.schools,base.schools.filter(s=>s.id===dukeId));
  addUnique(db.categories,base.categories.filter(c=>c.school_id===dukeId));
  addUnique(db.dimensions,base.dimensions.filter(d=>base.categories.some(c=>c.id===d.category_id&&c.school_id===dukeId)));
  const dukeEntities=base.entities.filter(entity=>entity.school_id===dukeId),entityIds=new Map<string,string>();
  for(const source of dukeEntities){const existing=db.entities.find(entity=>entity.school_id===dukeId&&entity.slug===source.slug);if(existing){entityIds.set(source.id,existing.id);Object.assign(existing,{...source,id:existing.id,parent_entity_id:source.parent_entity_id});}else{db.entities.push({...source});entityIds.set(source.id,source.id);}}
  for(const source of dukeEntities){const target=db.entities.find(entity=>entity.id===entityIds.get(source.id));if(target)target.parent_entity_id=source.parent_entity_id?entityIds.get(source.parent_entity_id)||null:null;}
  const legacyReviewIds=new Set(Array.from({length:48},(_,index)=>id(300+index)));
  db.reviews=db.reviews.filter(review=>!legacyReviewIds.has(review.id));db.values=db.values.filter(value=>!legacyReviewIds.has(value.review_id));
  for(const source of base.reviews.filter(review=>entityIds.has(review.entity_id))){const review={...source,entity_id:entityIds.get(source.entity_id)!};if(!db.reviews.some(item=>item.id===review.id))db.reviews.push(review);}
  for(const value of base.values)if(!db.values.some(item=>item.review_id===value.review_id&&item.rating_dimension_id===value.rating_dimension_id))db.values.push(value);
  addUnique(db.questions,base.questions.filter(q=>q.school_id===dukeId));addUnique(db.question_options,base.question_options.filter(o=>base.questions.some(q=>q.id===o.question_id&&q.school_id===dukeId)));
  addUnique(db.forum_editorial_identities,base.forum_editorial_identities);addUnique(db.forum_posts,base.forum_posts);addUnique(db.forum_post_images,base.forum_post_images);addUnique(db.forum_comments,base.forum_comments);
  for(const response of base.question_responses)if(!db.question_responses.some(r=>r.question_id===response.question_id&&r.user_id===response.user_id))db.question_responses.push(response);
  return db;
}
