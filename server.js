"use strict";
require("dotenv").config({ path: require("node:path").join(__dirname, ".env") });
const path=require("node:path"),http=require("node:http"),crypto=require("node:crypto");
const express=require("express"),mongoose=require("mongoose"),bcrypt=require("bcryptjs"),jwt=require("jsonwebtoken");
const {Server}=require("socket.io");
const PORT=Number(process.env.PORT||3000),HOST=process.env.HOST||"0.0.0.0",NODE_ENV=process.env.NODE_ENV||"development";
const JWT_SECRET=process.env.JWT_SECRET||(NODE_ENV==="production"?"":"change-this-local-prototype-secret-before-deploy");
const MONGODB_URI=process.env.MONGODB_URI||process.env.MONGO_URI||"";
const ADMIN_NICK=process.env.ADMIN_NICK||"SofterX",ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||(NODE_ENV==="production"?"":"SofterX");
const MODES=new Set(["team_fight","allies","training"]),MAPS=new Set(["Sandstone","Zone 9","Province","Rust"]),MAX_CHAT_LENGTH=1000;

const userSchema=new mongoose.Schema({
 playerId:{type:String,required:true,unique:true,index:true},
 nickname:{type:String,required:true,trim:true,minlength:2,maxlength:24,index:true},
 nicknameKey:{type:String,required:true,unique:true,index:true},
 passwordHash:{type:String,required:true,select:false},
 role:{type:String,enum:["player","tester","admin"],default:"player",index:true},
 gold:{type:Number,default:2450,min:0},coins:{type:Number,default:160,min:0},avatar:{type:String,default:""},
 skins:{type:[String],default:["usp","gloves"]},friends:[{type:mongoose.Schema.Types.ObjectId,ref:"User"}],
 clanId:{type:mongoose.Schema.Types.ObjectId,ref:"Clan",default:null},
 selectedSide:{type:String,enum:["T","CT"],default:"T"},
 selectedAnimation:{type:String,default:"Excited"},selectedWeapon:{type:String,default:"USP"},
 createdAt:{type:Date,default:Date.now},lastSeenAt:{type:Date,default:Date.now}
},{versionKey:false});
const lobbySchema=new mongoose.Schema({
 leader:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
 members:[{type:mongoose.Schema.Types.ObjectId,ref:"User"}],invited:[{type:mongoose.Schema.Types.ObjectId,ref:"User"}],
 mode:{type:String,enum:Array.from(MODES),default:"team_fight"},map:{type:String,enum:Array.from(MAPS),default:"Sandstone"},
 enemyType:{type:String,enum:["players","bots"],default:"players"},private:{type:Boolean,default:true},
 createdAt:{type:Date,default:Date.now},updatedAt:{type:Date,default:Date.now}
},{versionKey:false});
const clanSchema=new mongoose.Schema({
 name:{type:String,required:true,trim:true,minlength:3,maxlength:32},
 tag:{type:String,required:true,trim:true,uppercase:true,minlength:2,maxlength:6,unique:true},
 leader:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
 members:[{type:mongoose.Schema.Types.ObjectId,ref:"User"}],createdAt:{type:Date,default:Date.now}
},{versionKey:false});
const messageSchema=new mongoose.Schema({
 kind:{type:String,enum:["direct","lobby"],default:"direct",index:true},
 from:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
 to:{type:mongoose.Schema.Types.ObjectId,ref:"User",default:null},
 lobbyId:{type:mongoose.Schema.Types.ObjectId,ref:"Lobby",default:null},
 text:{type:String,required:true,maxlength:MAX_CHAT_LENGTH},createdAt:{type:Date,default:Date.now,index:true}
},{versionKey:false});
const User=mongoose.models.User||mongoose.model("User",userSchema);
const Lobby=mongoose.models.Lobby||mongoose.model("Lobby",lobbySchema);
const Clan=mongoose.models.Clan||mongoose.model("Clan",clanSchema);
const ChatMessage=mongoose.models.ChatMessage||mongoose.model("ChatMessage",messageSchema);

const app=express(),server=http.createServer(app),io=new Server(server,{serveClient:true,cors:{origin:true,credentials:true}});
app.disable("x-powered-by");app.set("trust proxy",1);
app.use(express.json({limit:"5mb"}));app.use(express.urlencoded({extended:false,limit:"1mb"}));
app.use((req,res,next)=>{res.setHeader("X-Content-Type-Options","nosniff");res.setHeader("Referrer-Policy","same-origin");res.setHeader("Permissions-Policy","camera=(), microphone=(), geolocation=()");next()});
function apiError(res,status,message){return res.status(status).json({error:message})}
function requireDatabase(req,res,next){if(mongoose.connection.readyState!==1)return apiError(res,503,"MongoDB не подключена. Настрой MONGODB_URI в .env или Render Environment.");next()}
function createToken(user){return jwt.sign({sub:String(user._id),role:user.role,playerId:user.playerId},JWT_SECRET,{expiresIn:"14d"})}
function safeUser(u){if(!u)return null;return {id:String(u._id),playerId:u.playerId,nickname:u.nickname,role:u.role,isAdmin:u.role==="admin",isTester:u.role==="admin"||u.role==="tester",gold:Number(u.gold||0),coins:Number(u.coins||0),avatar:u.avatar||"",skins:u.skins||[],selectedSide:u.selectedSide||"T",selectedAnimation:u.selectedAnimation||"Excited",selectedWeapon:u.selectedWeapon||"USP",clanId:u.clanId?String(u.clanId):null,createdAt:u.createdAt}}
async function findUserByPlayerId(id,includePassword){const q=User.findOne({playerId:String(id)});if(includePassword)q.select("+passwordHash");return q}
async function generatePlayerId(){for(let i=0;i<500;i++){const id=String(10000+crypto.randomInt(0,90000));if(!(await User.exists({playerId:id})))return id}throw new Error("Не удалось подобрать свободный пятизначный ID.")}
async function getAuthUser(req){const h=req.headers.authorization||"",token=h.startsWith("Bearer ")?h.slice(7):String(req.query.token||"");if(!token)return null;try{const p=jwt.verify(token,JWT_SECRET);return await User.findById(p.sub)}catch{return null}}
async function auth(req,res,next){try{req.user=await getAuthUser(req);if(!req.user)return apiError(res,401,"Войди в аккаунт.");next()}catch(e){next(e)}}
function adminOnly(req,res,next){if(!req.user||req.user.role!=="admin")return apiError(res,403,"Эта операция доступна только администратору.");next()}
function isFriend(user,id){return (user.friends||[]).some(x=>String(x)===String(id))}
async function ensureAdmin(){
 const key=ADMIN_NICK.toLowerCase();let u=await User.findOne({nicknameKey:key}).select("+passwordHash");
 if(!u){let playerId="10001";if(await User.exists({playerId}))playerId=await generatePlayerId();
 u=await User.create({playerId,nickname:ADMIN_NICK,nicknameKey:key,passwordHash:await bcrypt.hash(ADMIN_PASSWORD,12),role:"admin",gold:999999,coins:999999,skins:["usp","akr","m4","p350","karambit","gloves"]});
 console.log("[bootstrap] Admin created. ID="+u.playerId+"; password=ADMIN_PASSWORD/default SofterX.");}
 else if(u.role!=="admin"){u.role="admin";await u.save()}
}
async function loadLobby(id){if(!mongoose.isValidObjectId(id))return null;return Lobby.findById(id).populate("leader","playerId nickname role gold coins avatar skins selectedSide selectedAnimation selectedWeapon clanId createdAt").populate("members","playerId nickname role gold coins avatar skins selectedSide selectedAnimation selectedWeapon clanId createdAt").populate("invited","playerId nickname")}
function lobbyPayload(l){if(!l)return null;return {id:String(l._id),leader:safeUser(l.leader),members:(l.members||[]).map(safeUser),invited:(l.invited||[]).map(safeUser),mode:l.mode,map:l.map,enemyType:l.enemyType,private:l.private,isFull:(l.members||[]).length>=4,updatedAt:l.updatedAt}}
async function broadcastLobby(id){const l=await loadLobby(id);if(!l)return;const payload=lobbyPayload(l);io.to("lobby:"+String(l._id)).emit("lobby:update",payload);for(const u of l.members||[])io.to("user:"+String(u._id)).emit("lobby:update",payload)}

app.get("/api/health",(req,res)=>res.json({ok:true,service:"standoffx-prototype",database:mongoose.connection.readyState===1?"connected":"disconnected",databaseName:mongoose.connection.readyState===1?mongoose.connection.name:null,socket:true,time:new Date().toISOString()}));
app.post("/api/auth/register",requireDatabase,async(req,res,next)=>{try{
 const nickname=String(req.body.nickname||"").trim(),password=String(req.body.password||"");
 if(!/^[\p{L}\p{N}_-]{2,24}$/u.test(nickname))return apiError(res,400,"Ник: 2–24 буквы, цифры, _ или -.");
 if(password.length<6||password.length>72)return apiError(res,400,"Пароль должен содержать от 6 до 72 символов.");
 const nicknameKey=nickname.toLowerCase();if(await User.exists({nicknameKey}))return apiError(res,409,"Этот ник уже занят.");
 const user=await User.create({playerId:await generatePlayerId(),nickname,nicknameKey,passwordHash:await bcrypt.hash(password,12),role:"player"});
 return res.status(201).json({token:createToken(user),user:safeUser(user),message:"Аккаунт создан. Сохрани пятизначный ID: "+user.playerId});
}catch(e){if(e&&e.code===11000)return apiError(res,409,"Этот ник или ID уже используется.");next(e)}});
app.post("/api/auth/login",requireDatabase,async(req,res,next)=>{try{
 const playerId=String(req.body.playerId||"").trim(),password=String(req.body.password||"");
 if(!/^\d{5}$/.test(playerId))return apiError(res,400,"ID должен состоять ровно из пяти цифр.");
 const u=await findUserByPlayerId(playerId,true);if(!u||!(await bcrypt.compare(password,u.passwordHash)))return apiError(res,401,"Неверный ID или пароль.");
 u.lastSeenAt=new Date();await u.save();return res.json({token:createToken(u),user:safeUser(u)});
}catch(e){next(e)}});
app.get("/api/auth/me",requireDatabase,auth,(req,res)=>res.json({user:safeUser(req.user)}));
app.post("/api/auth/logout",auth,(req,res)=>res.json({ok:true}));
app.post("/api/auth/change-password",requireDatabase,auth,async(req,res,next)=>{try{
 const oldPassword=String(req.body.oldPassword||""),newPassword=String(req.body.newPassword||""),u=await User.findById(req.user._id).select("+passwordHash");
 if(!u||!(await bcrypt.compare(oldPassword,u.passwordHash)))return apiError(res,401,"Старый пароль не совпадает.");
 if(newPassword.length<6||newPassword.length>72)return apiError(res,400,"Новый пароль должен быть длиной 6–72 символа.");
 u.passwordHash=await bcrypt.hash(newPassword,12);await u.save();res.json({ok:true});
}catch(e){next(e)}});
app.patch("/api/profile",requireDatabase,auth,async(req,res,next)=>{try{
 const update={};if(typeof req.body.avatar==="string"){if(req.body.avatar.length>350000)return apiError(res,400,"Аватар слишком большой.");if(req.body.avatar&&!/^data:image\/(jpeg|png|webp);base64,/.test(req.body.avatar))return apiError(res,400,"Неверный формат аватара.");update.avatar=req.body.avatar}
 if(["T","CT"].includes(req.body.selectedSide))update.selectedSide=req.body.selectedSide;
 if(["Excited","Illegal Elbow Punch","Talking On Phone"].includes(req.body.selectedAnimation))update.selectedAnimation=req.body.selectedAnimation;
 if(["USP","P350","AKR","M4"].includes(req.body.selectedWeapon))update.selectedWeapon=req.body.selectedWeapon;
 const u=await User.findByIdAndUpdate(req.user._id,{$set:update},{new:true,runValidators:true});res.json({user:safeUser(u)});
}catch(e){next(e)}});

app.get("/api/users/search",requireDatabase,auth,async(req,res)=>{const q=String(req.query.q||"").trim();if(q.length<2)return res.json({users:[]});const escaped=q.replace(/[.*+?^$|()[\]{}\\]/g,"\\$&"),regex=new RegExp(escaped,"i");const rows=await User.find({_id:{$ne:req.user._id},$or:[{nickname:regex},{playerId:regex}]}).limit(10);res.json({users:rows.map(safeUser)})});
app.get("/api/friends",requireDatabase,auth,async(req,res)=>{await req.user.populate("friends","playerId nickname avatar role lastSeenAt");res.json({friends:(req.user.friends||[]).map(u=>Object.assign(safeUser(u),{online:(io.sockets.adapter.rooms.get("user:"+String(u._id))||new Set()).size>0}))})});
app.post("/api/friends/add",requireDatabase,auth,async(req,res,next)=>{try{
 const id=String(req.body.playerId||"").trim();if(!/^\d{5}$/.test(id))return apiError(res,400,"Введи ID из пяти цифр.");
 const other=await findUserByPlayerId(id,false);if(!other)return apiError(res,404,"Игрок с таким ID не найден.");if(String(other._id)===String(req.user._id))return apiError(res,400,"Нельзя добавить самого себя.");
 await User.updateOne({_id:req.user._id},{$addToSet:{friends:other._id}});await User.updateOne({_id:other._id},{$addToSet:{friends:req.user._id}});io.to("user:"+String(other._id)).emit("friends:update");res.json({ok:true,friend:safeUser(other)});
}catch(e){next(e)}});
app.delete("/api/friends/:playerId",requireDatabase,auth,async(req,res)=>{const other=await findUserByPlayerId(req.params.playerId,false);if(!other)return apiError(res,404,"Игрок не найден.");await User.updateOne({_id:req.user._id},{$pull:{friends:other._id}});await User.updateOne({_id:other._id},{$pull:{friends:req.user._id}});res.json({ok:true})});

app.get("/api/lobby/me",requireDatabase,auth,async(req,res)=>{const l=await Lobby.findOne({members:req.user._id});res.json({lobby:l?lobbyPayload(await loadLobby(l._id)):null})});
app.post("/api/lobby/create",requireDatabase,auth,async(req,res,next)=>{try{
 const existing=await Lobby.findOne({members:req.user._id});if(existing)return res.json({lobby:lobbyPayload(await loadLobby(existing._id))});
 let mode=MODES.has(req.body.mode)?req.body.mode:"team_fight";const map=MAPS.has(req.body.map)?req.body.map:"Sandstone";if(mode==="training"&&!["tester","admin"].includes(req.user.role))mode="team_fight";
 const l=await Lobby.create({leader:req.user._id,members:[req.user._id],mode,map}),payload=lobbyPayload(await loadLobby(l._id));
 io.to("user:"+String(req.user._id)).emit("lobby:update",payload);io.sockets.sockets.forEach(sock=>{if(sock.data.user&&String(sock.data.user._id)===String(req.user._id))sock.join("lobby:"+String(l._id))});res.status(201).json({lobby:payload});
}catch(e){next(e)}});
app.post("/api/lobby/:id/invite",requireDatabase,auth,async(req,res,next)=>{try{
 const l=await Lobby.findById(req.params.id);if(!l)return apiError(res,404,"Лобби не найдено.");if(String(l.leader)!==String(req.user._id))return apiError(res,403,"Приглашать может только лидер.");
 const other=await findUserByPlayerId(req.body.playerId,false);if(!other||!isFriend(req.user,other._id))return apiError(res,404,"Добавь игрока в друзья перед приглашением.");if(l.members.length>=4)return apiError(res,409,"Лобби заполнено.");
 l.invited.addToSet(other._id);l.updatedAt=new Date();await l.save();io.to("user:"+String(other._id)).emit("lobby:invite",{lobbyId:String(l._id),from:safeUser(req.user),mode:l.mode,map:l.map});res.json({ok:true});
}catch(e){next(e)}});
app.post("/api/lobby/:id/join",requireDatabase,auth,async(req,res,next)=>{try{
 const l=await Lobby.findById(req.params.id);if(!l)return apiError(res,404,"Лобби не найдено.");
 const inLobby=l.members.some(x=>String(x)===String(req.user._id)),invited=l.invited.some(x=>String(x)===String(req.user._id));
 if(!inLobby&&!invited)return apiError(res,403,"Для входа нужно приглашение лидера.");if(!inLobby&&l.members.length>=4)return apiError(res,409,"Лобби заполнено.");
 l.members.addToSet(req.user._id);l.invited.pull(req.user._id);l.updatedAt=new Date();await l.save();
 io.sockets.sockets.forEach(sock=>{if(sock.data.user&&String(sock.data.user._id)===String(req.user._id))sock.join("lobby:"+String(l._id))});
 await broadcastLobby(l._id);res.json({lobby:lobbyPayload(await loadLobby(l._id))});
}catch(e){next(e)}});
app.post("/api/lobby/:id/leave",requireDatabase,auth,async(req,res,next)=>{try{
 const l=await Lobby.findById(req.params.id);if(!l)return res.json({ok:true});l.members.pull(req.user._id);l.invited.pull(req.user._id);
 if(!l.members.length)await Lobby.deleteOne({_id:l._id});else{if(String(l.leader)===String(req.user._id))l.leader=l.members[0];l.updatedAt=new Date();await l.save();await broadcastLobby(l._id)}
 io.sockets.sockets.forEach(sock=>{if(sock.data.user&&String(sock.data.user._id)===String(req.user._id))sock.leave("lobby:"+String(l._id))});io.to("user:"+String(req.user._id)).emit("lobby:update",null);res.json({ok:true});
}catch(e){next(e)}});
app.patch("/api/lobby/:id/settings",requireDatabase,auth,async(req,res,next)=>{try{
 const l=await Lobby.findById(req.params.id);if(!l)return apiError(res,404,"Лобби не найдено.");if(String(l.leader)!==String(req.user._id))return apiError(res,403,"Только лидер лобби может менять режим, карту и состав.");
 if(req.body.mode!==undefined){if(!MODES.has(req.body.mode))return apiError(res,400,"Неизвестный режим.");if(req.body.mode==="training"&&!["tester","admin"].includes(req.user.role))return apiError(res,403,"Режим тестера доступен только тестерам.");l.mode=req.body.mode}
 if(req.body.map!==undefined){if(!MAPS.has(req.body.map))return apiError(res,400,"Неизвестная карта.");l.map=req.body.map}
 if(req.body.enemyType!==undefined){if(!["players","bots"].includes(req.body.enemyType))return apiError(res,400,"Неверный состав.");if(req.body.enemyType==="bots"&&!["tester","admin"].includes(req.user.role))return apiError(res,403,"Боты разрешены только тестировщикам.");l.enemyType=req.body.enemyType}
 l.updatedAt=new Date();await l.save();await broadcastLobby(l._id);res.json({lobby:lobbyPayload(await loadLobby(l._id))});
}catch(e){next(e)}});

app.get("/api/chat/:playerId",requireDatabase,auth,async(req,res)=>{const other=await findUserByPlayerId(req.params.playerId,false);if(!other||!isFriend(req.user,other._id))return apiError(res,403,"Чат доступен только с друзьями.");
 const msgs=await ChatMessage.find({kind:"direct",$or:[{from:req.user._id,to:other._id},{from:other._id,to:req.user._id}]}).sort({createdAt:1}).limit(250).populate("from","playerId nickname").populate("to","playerId nickname");
 res.json({messages:msgs.map(m=>({id:String(m._id),text:m.text,kind:m.kind,from:m.from?{playerId:m.from.playerId,nickname:m.from.nickname}:null,to:m.to?{playerId:m.to.playerId,nickname:m.to.nickname}:null,createdAt:m.createdAt}))})});
app.post("/api/chat/:playerId",requireDatabase,auth,async(req,res,next)=>{try{
 const other=await findUserByPlayerId(req.params.playerId,false);if(!other||!isFriend(req.user,other._id))return apiError(res,403,"Чат доступен только с друзьями.");
 const text=String(req.body.text||"").trim().slice(0,MAX_CHAT_LENGTH);if(!text)return apiError(res,400,"Сообщение пустое.");
 const m=await ChatMessage.create({kind:"direct",from:req.user._id,to:other._id,text});
 const payload={id:String(m._id),text:m.text,from:{playerId:req.user.playerId,nickname:req.user.nickname},to:{playerId:other.playerId,nickname:other.nickname},createdAt:m.createdAt};
 io.to("user:"+String(req.user._id)).emit("chat:new",payload);io.to("user:"+String(other._id)).emit("chat:new",payload);res.status(201).json({message:payload});
}catch(e){next(e)}});

const MARKET_PRICES={usp:0,akr:1850,m4:2200,p350:650,karambit:2400,gloves:900};
const MARKET_WEAPONS={usp:"USP",akr:"AKR",m4:"M4",p350:"P350"};
app.get("/api/market",requireDatabase,auth,async(req,res)=>res.json({gold:req.user.gold,skins:req.user.skins||[],items:[
 {id:"usp",name:"USP",type:"Пистолет",price:0},{id:"akr",name:"AKR",type:"Винтовка",price:1850},
 {id:"m4",name:"M4",type:"Винтовка",price:2200},{id:"p350",name:"P350",type:"Пистолет",price:650},
 {id:"karambit",name:"Karambit",type:"Нож",price:2400},{id:"gloves",name:"Перчатки",type:"Перчатки",price:900}
]}));
app.post("/api/market/buy",requireDatabase,auth,async(req,res,next)=>{try{
 const itemId=String(req.body.itemId||"");if(!Object.prototype.hasOwnProperty.call(MARKET_PRICES,itemId))return apiError(res,400,"Предмет не найден.");
 const u=await User.findById(req.user._id);if((u.skins||[]).includes(itemId))return apiError(res,409,"Предмет уже в инвентаре.");
 const price=MARKET_PRICES[itemId];if(u.gold<price)return apiError(res,400,"Не хватает золота.");
 u.gold-=price;u.skins.addToSet(itemId);if(MARKET_WEAPONS[itemId])u.selectedWeapon=MARKET_WEAPONS[itemId];await u.save();
 io.to("user:"+String(u._id)).emit("profile:update",safeUser(u));res.json({user:safeUser(u)});
}catch(e){next(e)}});
app.post("/api/market/equip",requireDatabase,auth,async(req,res,next)=>{try{
 const itemId=String(req.body.itemId||"");if(!Object.prototype.hasOwnProperty.call(MARKET_PRICES,itemId))return apiError(res,400,"Предмет не найден.");
 const u=await User.findById(req.user._id);if(!(u.skins||[]).includes(itemId))return apiError(res,403,"Сначала получи предмет.");
 if(MARKET_WEAPONS[itemId])u.selectedWeapon=MARKET_WEAPONS[itemId];await u.save();res.json({user:safeUser(u)});
}catch(e){next(e)}});

app.get("/api/clans",requireDatabase,auth,async(req,res)=>{const rows=await Clan.find().sort({createdAt:-1}).limit(100).populate("leader","playerId nickname").populate("members","playerId nickname");res.json({clans:rows.map(c=>({id:String(c._id),name:c.name,tag:c.tag,leader:c.leader?{playerId:c.leader.playerId,nickname:c.leader.nickname}:null,members:(c.members||[]).map(m=>({playerId:m.playerId,nickname:m.nickname})),createdAt:c.createdAt}))})});
app.post("/api/clans",requireDatabase,auth,async(req,res,next)=>{try{if(req.user.clanId)return apiError(res,409,"Ты уже состоишь в клане.");
 const name=String(req.body.name||"").trim(),tag=String(req.body.tag||"").trim().toUpperCase();if(name.length<3||name.length>32||!/^[A-Z0-9]{2,6}$/.test(tag))return apiError(res,400,"Название: 3–32 символа, тег: 2–6 латинских букв/цифр.");
 const c=await Clan.create({name,tag,leader:req.user._id,members:[req.user._id]});await User.updateOne({_id:req.user._id},{$set:{clanId:c._id}});res.status(201).json({clan:{id:String(c._id),name:c.name,tag:c.tag}});
}catch(e){if(e&&e.code===11000)return apiError(res,409,"Тег клана уже занят.");next(e)}});
app.post("/api/clans/:id/join",requireDatabase,auth,async(req,res)=>{if(req.user.clanId)return apiError(res,409,"Сначала выйди из текущего клана.");const c=await Clan.findById(req.params.id);if(!c)return apiError(res,404,"Клан не найден.");c.members.addToSet(req.user._id);await c.save();await User.updateOne({_id:req.user._id},{$set:{clanId:c._id}});res.json({ok:true})});
app.post("/api/clans/leave",requireDatabase,auth,async(req,res)=>{if(!req.user.clanId)return apiError(res,400,"Ты не состоишь в клане.");const c=await Clan.findById(req.user.clanId);if(c){if(String(c.leader)===String(req.user._id))return apiError(res,400,"Лидер должен передать лидерство или распустить клан через администратора.");c.members.pull(req.user._id);await c.save()}await User.updateOne({_id:req.user._id},{$set:{clanId:null}});res.json({ok:true})});

app.get("/api/admin/database",requireDatabase,auth,adminOnly,async(req,res)=>{const [users,admins,clans,lobbies,messages]=await Promise.all([User.countDocuments(),User.countDocuments({role:"admin"}),Clan.countDocuments(),Lobby.countDocuments(),ChatMessage.countDocuments()]);res.json({database:mongoose.connection.name,connected:true,counts:{users,admins,clans,lobbies,messages}})});
app.get("/api/admin/users",requireDatabase,auth,adminOnly,async(req,res)=>{const rows=await User.find().sort({createdAt:-1}).limit(500);res.json({users:rows.map(safeUser)})});
app.patch("/api/admin/users/:playerId",requireDatabase,auth,adminOnly,async(req,res,next)=>{try{
 const u=await findUserByPlayerId(req.params.playerId,true);if(!u)return apiError(res,404,"Игрок не найден.");
 if(req.body.gold!==undefined)u.gold=Math.max(0,Math.min(100000000,Number(req.body.gold)||0));if(req.body.coins!==undefined)u.coins=Math.max(0,Math.min(100000000,Number(req.body.coins)||0));
 if(req.body.role!==undefined){if(!["player","tester","admin"].includes(req.body.role))return apiError(res,400,"Неверная роль.");u.role=req.body.role}
 if(req.body.nickname!==undefined){const nick=String(req.body.nickname).trim();if(!/^[\p{L}\p{N}_-]{2,24}$/u.test(nick))return apiError(res,400,"Неверный ник.");const key=nick.toLowerCase();if(await User.exists({nicknameKey:key,_id:{$ne:u._id}}))return apiError(res,409,"Ник уже занят.");u.nickname=nick;u.nicknameKey=key}
 if(req.body.password!==undefined){const p=String(req.body.password);if(p.length<6||p.length>72)return apiError(res,400,"Пароль должен быть длиной 6–72 символа.");u.passwordHash=await bcrypt.hash(p,12)}
 if(req.body.skins!==undefined){if(!Array.isArray(req.body.skins)||req.body.skins.some(x=>typeof x!=="string"||x.length>80))return apiError(res,400,"Неверный список предметов.");u.skins=[...new Set(req.body.skins)].slice(0,300)}
 await u.save();io.to("user:"+String(u._id)).emit("profile:update",safeUser(u));res.json({user:safeUser(u)});
}catch(e){next(e)}});
app.delete("/api/admin/users/:playerId",requireDatabase,auth,adminOnly,async(req,res)=>{const u=await findUserByPlayerId(req.params.playerId,false);if(!u)return apiError(res,404,"Игрок не найден.");if(u.nicknameKey===ADMIN_NICK.toLowerCase())return apiError(res,403,"Защищённую учётную запись администратора нельзя удалить.");await User.updateMany({friends:u._id},{$pull:{friends:u._id}});await ChatMessage.deleteMany({$or:[{from:u._id},{to:u._id}]});await Lobby.updateMany({members:u._id},{$pull:{members:u._id,invited:u._id}});await User.deleteOne({_id:u._id});res.json({ok:true})});
app.get("/api/admin/clans",requireDatabase,auth,adminOnly,async(req,res)=>{const rows=await Clan.find().populate("leader","playerId nickname").populate("members","playerId nickname").limit(500);res.json({clans:rows.map(c=>({id:String(c._id),name:c.name,tag:c.tag,leader:c.leader?{playerId:c.leader.playerId,nickname:c.leader.nickname}:null,members:(c.members||[]).map(m=>({playerId:m.playerId,nickname:m.nickname}))}))})});
app.patch("/api/admin/clans/:id",requireDatabase,auth,adminOnly,async(req,res,next)=>{try{const c=await Clan.findById(req.params.id);if(!c)return apiError(res,404,"Клан не найден.");if(req.body.name!==undefined)c.name=String(req.body.name).trim().slice(0,32);if(req.body.tag!==undefined)c.tag=String(req.body.tag).trim().toUpperCase().slice(0,6);await c.save();res.json({ok:true})}catch(e){if(e&&e.code===11000)return apiError(res,409,"Тег уже используется.");next(e)}});
app.delete("/api/admin/clans/:id",requireDatabase,auth,adminOnly,async(req,res)=>{const c=await Clan.findById(req.params.id);if(!c)return apiError(res,404,"Клан не найден.");await User.updateMany({clanId:c._id},{$set:{clanId:null}});await Clan.deleteOne({_id:c._id});res.json({ok:true})});


const activeMatches = new Map();
let matchTickTimer = null;
const MATCH_STEP = 0.05;
const MATCH_SPAWNS = [[-5, 8], [5, 8], [-5, 13], [5, 13]];
function matchPlayerCount(match) { return Object.keys(match.players).length; }
function cleanMatchPlayer(p) {
 return { id:p.playerId, playerId:p.playerId, nickname:p.nickname, side:p.side, animation:p.animation, weapon:p.weapon, x:p.x, z:p.z, yaw:p.yaw, pitch:p.pitch, hp:p.hp, ammo:p.ammo, maxAmmo:p.maxAmmo, kills:p.kills, online:p.online, isBot:false };
}
function matchSnapshot(match) {
 return { id:match.id, mode:match.mode, map:match.map, status:match.status, createdAt:match.createdAt,
  players:Object.values(match.players).map(cleanMatchPlayer),
  bots:match.bots.map(b=>({id:b.id,playerId:b.id,nickname:b.nickname,side:b.side,animation:b.animation,weapon:"AKR",x:b.x,z:b.z,yaw:b.yaw,pitch:0,hp:b.hp,ammo:30,maxAmmo:30,kills:b.kills,online:true,isBot:true,alive:b.alive})) };
}
function sendMatchState(match) { io.to("match:"+match.id).emit("match:state",matchSnapshot(match)); }
function playerSpawn(index, side) {
 const p=MATCH_SPAWNS[index%MATCH_SPAWNS.length];
 return {x:p[0],z:p[1],side:side||((index%2===0)?"T":"CT")};
}
function addMatchPlayer(match,user) {
 const id=String(user._id);
 if(match.players[id]) { match.players[id].online=true; return match.players[id]; }
 const index=matchPlayerCount(match),spawn=playerSpawn(index,index%2===0?"T":"CT");
 const weapon=["USP","P350","AKR","M4"].includes(user.selectedWeapon)?user.selectedWeapon:"USP";
 const maxAmmo=(weapon==="USP"||weapon==="P350")?12:30;
 const p={userId:id,playerId:user.playerId,nickname:user.nickname,side:user.selectedSide||spawn.side,animation:user.selectedAnimation||"Excited",weapon,
  x:spawn.x,z:spawn.z,yaw:Math.PI,pitch:0,hp:100,ammo:maxAmmo,maxAmmo,kills:0,online:true,keys:{},lastShotAt:0,reloadAt:0,respawnAt:0,lastInputAt:Date.now()};
 match.players[id]=p;
 return p;
}
function makeBots(match,count) {
 match.bots=[];
 const points=[[-7,-9],[5,-11],[-1,-15]];
 const human=Object.values(match.players)[0];
 const botSide=human&&human.side==="T"?"CT":"T";
 for(let i=0;i<count;i++){const p=points[i%points.length];match.bots.push({id:"bot-"+(i+1),nickname:"BOT "+String(i+1).padStart(2,"0"),side:botSide,animation:"Excited",x:p[0],z:p[1],yaw:0,hp:100,kills:0,shootAt:Date.now()+1500+Math.random()*1500,goalX:(Math.random()-.5)*15,goalZ:-5-Math.random()*10,respawnAt:0,alive:true});}
}
async function addUserSocketsToMatch(match,userIds) {
 const target=new Set(userIds.map(String));
 io.sockets.sockets.forEach(sock=>{
  if(sock.data.user&&target.has(String(sock.data.user._id))) {
   sock.join("match:"+match.id);
   sock.emit("match:launch",matchSnapshot(match));
  }
 });
}
function nearestEnemy(match,attacker) {
 let winner=null,best=Infinity;
 for(const p of Object.values(match.players)){if(p.userId===attacker.userId||p.side===attacker.side||p.hp<=0)continue;const d=Math.hypot(p.x-attacker.x,p.z-attacker.z);if(d<best){best=d;winner=p;}}
 for(const b of match.bots){if(!b.alive||b.side===attacker.side)continue;const d=Math.hypot(b.x-attacker.x,b.z-attacker.z);if(d<best){best=d;winner=b;}}
 return winner?{target:winner,distance:best}:null;
}
function stepMatch(match,now) {
 for(const p of Object.values(match.players)){
  if(!p.online) {p.keys={};continue;}
  if(p.hp<=0) {if(p.respawnAt&&now>=p.respawnAt){const spawn=playerSpawn(Object.keys(match.players).indexOf(p.userId),p.side);p.x=spawn.x;p.z=spawn.z;p.hp=100;p.ammo=p.maxAmmo;p.respawnAt=0;} else continue;}
  if(p.reloadAt&&now>=p.reloadAt){p.ammo=p.maxAmmo;p.reloadAt=0;}
  const keys=p.keys||{},fwd={x:-Math.sin(p.yaw),z:-Math.cos(p.yaw)},right={x:Math.cos(p.yaw),z:-Math.sin(p.yaw)};
  let dx=0,dz=0;
  if(keys.forward){dx+=fwd.x;dz+=fwd.z;}if(keys.backward){dx-=fwd.x;dz-=fwd.z;}if(keys.right){dx+=right.x;dz+=right.z;}if(keys.left){dx-=right.x;dz-=right.z;}
  const length=Math.hypot(dx,dz);
  if(length>0){const speed=keys.sprint?7.2:4.4;p.x+=dx/length*speed*MATCH_STEP;p.z+=dz/length*speed*MATCH_STEP;}
  p.x=Math.max(-16,Math.min(16,p.x));p.z=Math.max(-17,Math.min(17,p.z));
  if(now-p.lastInputAt>5000)p.keys={};
 }
 for(const b of match.bots){
  if(!b.alive){if(now>=b.respawnAt){b.hp=100;b.alive=true;const sp=playerSpawn(match.bots.indexOf(b)+1,b.side);b.x=sp.x;b.z=sp.z;b.shootAt=now+2000;}continue;}
  const target=Object.values(match.players).filter(p=>p.online&&p.hp>0&&p.side!==b.side).sort((a,c)=>Math.hypot(a.x-b.x,a.z-b.z)-Math.hypot(c.x-b.x,c.z-b.z))[0];
  if(!target)continue;
  const dx=target.x-b.x,dz=target.z-b.z,d=Math.hypot(dx,dz)||1;b.yaw=Math.atan2(-dx,-dz);
  if(d>4){b.x+=dx/d*1.1*MATCH_STEP;b.z+=dz/d*1.1*MATCH_STEP;}
  if(d<13&&now>=b.shootAt){b.shootAt=now+1700+Math.random()*1800;if(Math.random()<0.32){target.hp=Math.max(0,target.hp-7);if(target.hp===0){target.respawnAt=now+2000;target.keys={};}io.to("user:"+target.userId).emit("match:hit",{from:b.nickname,hp:target.hp});}}
 }
 if(matchPlayerCount(match)===0){activeMatches.delete(match.id);return;}
 sendMatchState(match);
}
function startMatchTicker(){if(matchTickTimer)return;matchTickTimer=setInterval(()=>{const now=Date.now();for(const m of activeMatches.values()){if(now-m.lastActivity>300000&&Object.values(m.players).every(p=>!p.online)){activeMatches.delete(m.id);continue;}stepMatch(m,now)}},Math.round(MATCH_STEP*1000));if(matchTickTimer.unref)matchTickTimer.unref();}
app.post("/api/match/start",requireDatabase,auth,async(req,res,next)=>{try{
 const lobbyId=String(req.body.lobbyId||"");
 if(!mongoose.isValidObjectId(lobbyId))return apiError(res,400,"Не выбрано лобби.");
 const lobby=await Lobby.findById(lobbyId);
 if(!lobby)return apiError(res,404,"Лобби не найдено.");
 if(String(lobby.leader)!==String(req.user._id))return apiError(res,403,"Запустить матч может только лидер лобби.");
 const mode=lobby.mode,map=lobby.map;
 if(mode==="training"&&!["tester","admin"].includes(req.user.role))return apiError(res,403,"Режим тестера доступен только тестерам.");
 if(lobby.enemyType==="bots"&&!["tester","admin"].includes(req.user.role))return apiError(res,403,"Боты доступны только тестерам.");
 for(const m of activeMatches.values()){if(m.players[String(req.user._id)]){await addUserSocketsToMatch(m,Object.keys(m.players));return res.json({match:matchSnapshot(m)})}}
 const users=await User.find({_id:{$in:lobby.members}});
 if(!users.some(u=>String(u._id)===String(req.user._id)))users.unshift(req.user);
 let match=null;
 if(mode!=="training"&&users.length===1){
  match=Array.from(activeMatches.values()).find(m=>m.openQueue&&m.status==="active"&&m.mode===mode&&m.map===map&&Date.now()-m.createdAt<120000&&matchPlayerCount(m)<4);
 }
 if(!match){match={id:crypto.randomUUID(),mode,map,status:"active",createdAt:Date.now(),lastActivity:Date.now(),openQueue:mode!=="training"&&users.length===1,players:{},bots:[],scores:{T:0,CT:0}};activeMatches.set(match.id,match);}
 for(const u of users){if(matchPlayerCount(match)>=4)break;addMatchPlayer(match,u);}
 if(mode==="training"){const count=Math.max(0,Math.min(3,Number(req.body.botCount??2)||0));makeBots(match,count);}
 match.lastActivity=Date.now();startMatchTicker();
 await addUserSocketsToMatch(match,Object.keys(match.players));
 res.status(201).json({match:matchSnapshot(match)});
}catch(e){next(e)}});
app.get("/api/match/current",requireDatabase,auth,(req,res)=>{const m=Array.from(activeMatches.values()).find(x=>x.players[String(req.user._id)]);res.json({match:m?matchSnapshot(m):null})});
app.post("/api/match/leave",auth,(req,res)=>{const id=String(req.body.matchId||"");const m=activeMatches.get(id);if(m&&m.players[String(req.user._id)]){m.players[String(req.user._id)].online=false;m.players[String(req.user._id)].keys={};m.lastActivity=Date.now();io.to("match:"+id).emit("match:player-left",{playerId:req.user.playerId});}res.json({ok:true})});

io.use(async(socket,next)=>{const token=socket.handshake.auth&&socket.handshake.auth.token;if(!token)return next(new Error("AUTH_REQUIRED"));try{const p=jwt.verify(token,JWT_SECRET),u=await User.findById(p.sub);if(!u)return next(new Error("AUTH_REQUIRED"));socket.data.user=u;next()}catch{next(new Error("AUTH_REQUIRED"))}});
io.on("connection",async socket=>{
 const u=socket.data.user,uid=String(u._id);
 socket.join("user:"+uid);
 const lobby=await Lobby.findOne({members:u._id});if(lobby)socket.join("lobby:"+String(lobby._id));
 socket.emit("server:ready",{playerId:u.playerId,nickname:u.nickname});
 socket.broadcast.emit("presence:update",{playerId:u.playerId,online:true});
 const existingMatch=Array.from(activeMatches.values()).find(m=>m.players[uid]);
 if(existingMatch){existingMatch.players[uid].online=true;socket.join("match:"+existingMatch.id);socket.emit("match:launch",matchSnapshot(existingMatch));sendMatchState(existingMatch)}
 socket.on("lobby:join",async lobbyId=>{try{const l=await Lobby.findById(String(lobbyId||""));if(l&&l.members.some(id=>String(id)===uid))socket.join("lobby:"+String(l._id))}catch{}});
 socket.on("match:join",data=>{
  const id=String(data&&data.matchId||""),m=activeMatches.get(id),p=m&&m.players[uid];
  if(!m||!p)return;
  p.online=true;p.lastInputAt=Date.now();socket.join("match:"+id);
  socket.emit("match:launch",matchSnapshot(m));sendMatchState(m);
 });
 socket.on("match:input",data=>{
  const id=String(data&&data.matchId||""),m=activeMatches.get(id),p=m&&m.players[uid];
  if(!p||!p.online||p.hp<=0)return;
  const k=data&&data.keys||{};
  p.keys={forward:!!k.forward,backward:!!k.backward,left:!!k.left,right:!!k.right,sprint:!!k.sprint};
  p.yaw=Math.max(-Math.PI*4,Math.min(Math.PI*4,Number(data.yaw)||0));
  p.pitch=Math.max(-1.3,Math.min(1.3,Number(data.pitch)||0));
  p.weapon=["USP","P350","AKR","M4"].includes(data.weapon)?data.weapon:p.weapon;
  const cap=(p.weapon==="USP"||p.weapon==="P350")?12:30;
  if(p.maxAmmo!==cap){p.maxAmmo=cap;p.ammo=Math.min(p.ammo,cap)}
  p.lastInputAt=Date.now();m.lastActivity=Date.now();
 });
 socket.on("match:fire",data=>{
  const id=String(data&&data.matchId||""),m=activeMatches.get(id),p=m&&m.players[uid],now=Date.now();
  if(!m||!p||!p.online||p.hp<=0||p.reloadAt>now||p.ammo<=0)return;
  const interval=(p.weapon==="USP"||p.weapon==="P350")?280:115;
  if(now-p.lastShotAt<interval)return;
  p.lastShotAt=now;p.ammo--;
  const fx=-Math.sin(p.yaw),fz=-Math.cos(p.yaw),damage=(p.weapon==="AKR"||p.weapon==="M4")?38:34;
  let best=null,bestProj=Infinity;
  const candidates=[];
  for(const other of Object.values(m.players)){if(other.userId===p.userId||other.hp<=0||other.side===p.side)continue;candidates.push({target:other,id:other.userId,kind:"player",radius:.45})}
  for(const bot of m.bots){if(!bot.alive||bot.hp<=0||bot.side===p.side)continue;candidates.push({target:bot,id:bot.id,kind:"bot",radius:.65})}
  for(const c of candidates){
   const dx=c.target.x-p.x,dz=c.target.z-p.z,proj=dx*fx+dz*fz;
   if(proj<=0||proj>45||proj>=bestProj)continue;
   const lateral=Math.abs(dx*fz-dz*fx);
   if(lateral<=c.radius+proj*.026){best={...c,proj};bestProj=proj}
  }
  let result={matchId:id,hit:false,ammo:p.ammo};
  if(best){
   best.target.hp=Math.max(0,best.target.hp-damage);result={matchId:id,hit:true,target:best.target.nickname||best.id,killed:best.target.hp<=0,ammo:p.ammo,hp:best.target.hp};
   if(best.target.hp<=0){
    p.kills++;
    if(best.kind==="bot"){best.target.alive=false;best.target.respawnAt=now+1500}
    else {best.target.respawnAt=now+2200;best.target.keys={};}
   }
  }
  socket.emit("match:shot-result",result);m.lastActivity=now;sendMatchState(m);
 });
 socket.on("match:reload",data=>{
  const id=String(data&&data.matchId||""),m=activeMatches.get(id),p=m&&m.players[uid];
  if(!p||p.hp<=0||p.ammo>=p.maxAmmo||p.reloadAt>Date.now())return;
  p.reloadAt=Date.now()+650;socket.emit("match:reloading",{duration:650});
 });
 socket.on("lobby:chat",async data=>{try{
  const id=String(data&&data.lobbyId||""),text=String(data&&data.text||"").trim().slice(0,MAX_CHAT_LENGTH);
  if(!text||!mongoose.isValidObjectId(id))return;
  const l=await Lobby.findById(id);if(!l||!l.members.some(x=>String(x)===uid))return;
  const msg=await ChatMessage.create({kind:"lobby",from:u._id,lobbyId:l._id,text});
  io.to("lobby:"+id).emit("lobby:chat:new",{id:String(msg._id),text,from:{playerId:u.playerId,nickname:u.nickname},createdAt:msg.createdAt});
 }catch(e){console.error("[socket lobby:chat]",e.message)}});
 socket.on("disconnect",()=>{
  u.lastSeenAt=new Date();u.save().catch(()=>{});socket.broadcast.emit("presence:update",{playerId:u.playerId,online:false});
  for(const m of activeMatches.values()){const p=m.players[uid];if(p){p.online=false;p.keys={};m.lastActivity=Date.now();io.to("match:"+m.id).emit("match:player-left",{playerId:u.playerId})}}
 });
});

app.use(express.static(path.join(__dirname),{extensions:["html"]}));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"index.html")));
app.use((err,req,res,next)=>{console.error("[http]",err&&err.stack||err);if(res.headersSent)return next(err);const status=err&&err.name==="ValidationError"?400:500;res.status(status).json({error:status===400?"Некорректные данные.":"Внутренняя ошибка сервера."})});

let startPromise=null;
async function startServer(options={}){
 if(startPromise)return startPromise;const port=options.port===undefined?PORT:Number(options.port);
 if(NODE_ENV==="production"&&(!MONGODB_URI||!JWT_SECRET||!ADMIN_PASSWORD))throw new Error("Production startup requires MONGODB_URI, JWT_SECRET and ADMIN_PASSWORD environment variables.");
 startPromise=(async()=>{
  if(MONGODB_URI){try{await mongoose.connect(MONGODB_URI,{serverSelectionTimeoutMS:10000,autoIndex:true});console.log("[mongo] Connected: "+mongoose.connection.name);await ensureAdmin()}catch(e){console.error("[mongo] Connection failed:",e.message);console.error("[mongo] HTTP server remains online, but database routes return 503 until MONGODB_URI is fixed.")}}
  else console.warn("[mongo] MONGODB_URI is not configured. Login/register need MongoDB.");
  await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(port,HOST,()=>{server.removeListener("error",reject);resolve()})});
  const actualPort=server.address()&&server.address().port;console.log("[http] Listening on http://127.0.0.1:"+actualPort);return {app,server,io,port:actualPort};
 })();return startPromise;
}
async function stopServer(){if(server.listening)await new Promise(resolve=>server.close(resolve));io.close();if(mongoose.connection.readyState)await mongoose.disconnect()}
if(require.main===module){startServer().catch(e=>{console.error(e);process.exitCode=1});process.on("SIGINT",()=>stopServer().finally(()=>process.exit(0)));process.on("SIGTERM",()=>stopServer().finally(()=>process.exit(0)))}
module.exports={app,server,io,startServer,stopServer,User,Lobby,Clan,ChatMessage};
