// ════════════════════════════════════════
// FIREBASE CONFIG
// ════════════════════════════════════════
const firebaseConfig = {
  apiKey:            "AIzaSyDwaYBCfJvnT9srbNwYRTTj8aSxdsl9Y68",
  authDomain:        "isebe-e2a38.firebaseapp.com",
  projectId:         "isebe-e2a38",
  storageBucket:     "isebe-e2a38.firebasestorage.app",
  messagingSenderId: "1028278452111",
  appId:             "1:1028278452111:web:a0b85033f6b715c36195fa"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// ════════════════════════════════════════
// CLOUDINARY CONFIG (free image hosting)
// 1. Sign up free at cloudinary.com
// 2. Dashboard → Settings → Upload → Add upload preset → set to "Unsigned"
// 3. Fill in your Cloud Name and that preset name below
// ════════════════════════════════════════
const CLOUDINARY_CLOUD = 'jhayatelier';
const CLOUDINARY_PRESET = 'iseberestaurant';

// ── State ──────────────────────────────────────────────────────────────────
let cart = [];
let allMenuItems = [];
let whatsappNum = '2348000000000'; // ← REPLACE with your real WhatsApp number (digits only, no + or spaces)
let uploadedItemImgUrl = '';
let editingItemId = null;
let editingPostId = null;
let uploadedPostImgUrl = '';
let allBlogPosts = [];
// Firestore real-time unsubscribe handles
let unsubMenu = null;
let unsubHome = null;
let unsubBlog = null;

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(n){return '₦'+n.toLocaleString('en-NG')}
function totalItems(){return cart.reduce((s,i)=>s+i.qty,0)}
function totalPrice(){return cart.reduce((s,i)=>s+i.price*i.qty,0)}

let toastTimer;
function showToast(msg, type=''){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.className='toast', 2200);
}

// ── On load ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', ()=>{
  subscribeHomepage();
  subscribeMenu();
  subscribeBlog();
  auth.onAuthStateChanged(user => {
    if(user) showDash();
  });
});

// ════════════════════════════════════════
// HOMEPAGE CONTENT — real-time
// ════════════════════════════════════════
function subscribeHomepage(){
  unsubHome = db.collection('site').doc('homepage')
    .onSnapshot(snap => {
      if(snap.exists) applyHomepageContent(snap.data());
    }, ()=>{});
}

function applyHomepageContent(d){
  if(d.hero_image_url){
    document.getElementById('heroImg').src = d.hero_image_url;
  }
  if(d.hero_title) document.getElementById('heroTitle').textContent = d.hero_title;
  if(d.hero_sub){
    const heroSub = document.getElementById('heroSub');
    heroSub.textContent = '';
    d.hero_sub.split('\n').forEach((line, i, arr) => {
      heroSub.appendChild(document.createTextNode(line));
      if(i < arr.length - 1) heroSub.appendChild(document.createElement('br'));
    });
  }
  if(d.hero_tag) document.getElementById('heroTag').textContent = d.hero_tag;
  if(d.delivery_eta) document.getElementById('heroEta').textContent = d.delivery_eta;
  if(d.menu_sub) document.getElementById('menuSub').textContent = d.menu_sub;
  if(d.loc_short) document.getElementById('locAddress').textContent = d.loc_short;
  if(d.loc_full){
    const locFull = document.getElementById('locFull');
    locFull.textContent = '';
    d.loc_full.split('\n').forEach((line, i, arr) => {
      locFull.appendChild(document.createTextNode(line));
      if(i < arr.length - 1) locFull.appendChild(document.createElement('br'));
    });
  }
  if(d.loc_city) document.getElementById('locCity').textContent = d.loc_city;
  if(d.phone) document.getElementById('locPhone').textContent = d.phone;
  if(d.whatsapp_num) whatsappNum = d.whatsapp_num;
}

// ════════════════════════════════════════
// MENU ITEMS — real-time
// ════════════════════════════════════════
function subscribeMenu(){
  unsubMenu = db.collection('menu_items')
    .where('active','==',true)
    .onSnapshot(snap => {
      if(snap.empty){
        renderFallbackMenu();
        return;
      }
      allMenuItems = snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.sort_order-b.sort_order);
      renderMenuItems(allMenuItems);
      renderFeatured(allMenuItems);
      updateStats(allMenuItems);
    }, ()=> renderFallbackMenu());
}

function renderFeatured(items){
  const featured = items.filter(i=>i.featured);
  const wrap = document.getElementById('featuredScroll');
  const dots = document.getElementById('featuredDots');
  stopFeaturedCarousel();
  if(!featured.length){
    wrap.innerHTML = '<p style="font-size:13px;color:var(--ink-light);padding:10px 0">No featured items yet.</p>';
    dots.innerHTML = '';
    return;
  }
  wrap.innerHTML = featured.map(item=>`
    <div class="fcard" onclick="addItem('${esc(item.name)}',${item.price},'${esc(item.image_url||'')}')">
      <img class="fcard-img" src="${item.image_url||''}" alt="${esc(item.name)}" onerror="this.style.background='#FFE0CC';this.style.display='block'"/>
      <div class="fcard-body">
        <div class="fcard-badge"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>Fan fave</div>
        <div class="fcard-name">${item.name}</div>
        <div class="fcard-foot">
          <span class="fcard-price">${fmt(item.price)}</span>
          <button class="add-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
        </div>
      </div>
    </div>`).join('');

  setupFeaturedCarousel(featured.length);
}

// ── Featured carousel: swipeable + auto-advance ──────────────────────────
const FEATURED_AUTOPLAY_MS = 4500; // recommended interval between auto-swipes
let featuredTimer = null;
let featuredResumeTimer = null;
let featuredIndex = 0;

function stopFeaturedCarousel(){
  clearInterval(featuredTimer);
  clearTimeout(featuredResumeTimer);
  featuredTimer = null;
}

function setupFeaturedCarousel(count){
  const wrap = document.getElementById('featuredScroll');
  const dotsWrap = document.getElementById('featuredDots');
  featuredIndex = 0;

  // Build dots (hide if only one card)
  if(count > 1){
    dotsWrap.innerHTML = Array.from({length:count}).map((_,i)=>
      `<button class="featured-dot${i===0?' active':''}" onclick="goToFeatured(${i})" aria-label="Go to slide ${i+1}"></button>`
    ).join('');
  } else {
    dotsWrap.innerHTML = '';
  }

  if(count <= 1) return; // nothing to auto-play

  // Update dots as the user manually scrolls/swipes
  wrap.onscroll = ()=>{
    const cards = wrap.querySelectorAll('.fcard');
    if(!cards.length) return;
    const cardWidth = cards[0].offsetWidth + 14; // includes gap
    const idx = Math.round(wrap.scrollLeft / cardWidth);
    updateFeaturedDots(Math.min(idx, cards.length-1));
  };

  // Pause autoplay on manual interaction, resume after a short delay
  ['touchstart','pointerdown'].forEach(evt=>{
    wrap.addEventListener(evt, ()=>{
      clearInterval(featuredTimer);
      clearTimeout(featuredResumeTimer);
      featuredResumeTimer = setTimeout(startFeaturedAutoplay, FEATURED_AUTOPLAY_MS);
    }, {passive:true});
  });

  startFeaturedAutoplay();
}

function startFeaturedAutoplay(){
  clearInterval(featuredTimer);
  featuredTimer = setInterval(()=>{
    const wrap = document.getElementById('featuredScroll');
    const cards = wrap.querySelectorAll('.fcard');
    if(!cards.length) return;
    featuredIndex = (featuredIndex + 1) % cards.length;
    goToFeatured(featuredIndex);
  }, FEATURED_AUTOPLAY_MS);
}

function goToFeatured(i){
  const wrap = document.getElementById('featuredScroll');
  const cards = wrap.querySelectorAll('.fcard');
  if(!cards[i]) return;
  featuredIndex = i;
  const cardWidth = cards[0].offsetWidth + 14;
  wrap.scrollTo({left: cardWidth * i, behavior:'smooth'});
  updateFeaturedDots(i);
}

function updateFeaturedDots(i){
  document.querySelectorAll('.featured-dot').forEach((d,idx)=>d.classList.toggle('active', idx===i));
}

function renderMenuItems(items){
  const wrap = document.getElementById('menuList');
  if(!items.length){
    wrap.innerHTML = '<p style="font-size:13px;color:var(--ink-light);padding:10px 0">No menu items yet. Add some in the admin panel.</p>';
    return;
  }
  wrap.innerHTML = items.map(item=>`
    <div class="mitem" data-cat="${item.category}">
      <img class="mitem-img" src="${item.image_url||''}" alt="${esc(item.name)}" onerror="this.style.background='#FFE0CC'"/>
      <div class="mitem-info">
        <div class="mitem-name">${item.name}</div>
        <div class="mitem-desc">${item.description||''}</div>
        <div class="mitem-price">${fmt(item.price)}</div>
      </div>
      <button class="mitem-add" onclick="addItem('${esc(item.name)}',${item.price},'${esc(item.image_url||'')}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    </div>`).join('');
}

function renderFallbackMenu(){
  // Show original hard-coded items if DB is empty/not set up
  const items = [
    {name:'Jollof Rice & Chicken',price:5500,image_url:'https://images.unsplash.com/photo-1574484284002-952d92456975?w=200&auto=format&fit=crop&q=70',description:'Party jollof, smoky & spiced',category:'mains',featured:true},
    {name:'Beef Suya (Half Stick)',price:2500,image_url:'https://images.unsplash.com/photo-1544025162-d76694265947?w=200&auto=format&fit=crop&q=70',description:'Northern-style skewered beef',category:'suya',featured:true},
    {name:'Chicken Shawarma',price:3200,image_url:'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&auto=format&fit=crop&q=70',description:'Grilled chicken, garlic sauce & veggies',category:'shawarma',featured:false},
    {name:'Zobo Drink (500ml)',price:800,image_url:'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=200&auto=format&fit=crop&q=70',description:'Hibiscus, ginger & lemon',category:'drinks',featured:false},
    {name:'Fried Plantain (Dodo)',price:1200,image_url:'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=200&auto=format&fit=crop&q=70',description:'Sweet ripe plantain, golden-fried',category:'sides',featured:false},
  ];
  allMenuItems = items;
  renderMenuItems(items);
  renderFeatured(items);
  updateStats(items);
}

function updateStats(items){
  document.getElementById('statMenuCount').textContent = items.length;
  document.getElementById('statFeaturedCount').textContent = items.filter(i=>i.featured).length;
  document.getElementById('statLastUpdate').textContent = new Date().toLocaleString('en-NG',{dateStyle:'medium',timeStyle:'short'});
}

// ── Escape helper ─────────────────────────────────────────────────────────
function esc(s){return String(s).replace(/'/g,"\\'").replace(/"/g,'&quot;')}

// ════════════════════════════════════════
// BLOG — real-time
// ════════════════════════════════════════
function subscribeBlog(){
  unsubBlog = db.collection('blog_posts')
    .where('published','==',true)
    .orderBy('created_at','desc')
    .onSnapshot(snap => {
      if(snap.empty){
        allBlogPosts = getFakePosts();
        renderBlogPosts(allBlogPosts);
        return;
      }
      allBlogPosts = snap.docs.map(d=>({id:d.id,...d.data()}));
      renderBlogPosts(allBlogPosts);
      if(document.getElementById('adminDash').style.display!=='none') loadAdminBlogList();
    }, ()=>{
      allBlogPosts = getFakePosts();
      renderBlogPosts(allBlogPosts);
    });
}

function getFakePosts(){
  return [{
    id: 'fake-001',
    title: 'The Secret Behind Our Smoky Party Jollof',
    excerpt: 'Everyone asks — what makes Isebe jollof taste like a celebration every single time? We finally decided to share (some of) the magic.',
    cover_image_url: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=900&auto=format&fit=crop&q=80',
    created_at: '2026-06-20T10:00:00Z',
    published: true,
    content: `There's a reason people drive from Surulere, Lekki, and even Abuja just to taste our jollof rice. It's not magic — well, maybe a little.

The foundation: the right tomato base
It all starts with a slow-cooked tomato, tatashe, and onion blend. We fry it low and slow for nearly 45 minutes until the raw smell is completely gone and the oil floats on top. That's when you know it's ready. Most people rush this step. We never do.

The firewood effect (and how we recreate it)
Authentic party jollof gets its smoky depth from open firewood cooking. In our kitchen, we achieve the same result by cranking the heat at the very end and letting the bottom of the pot catch slightly — that's the socata, the coveted crust Nigerians fight over. The smoke rises and infuses the entire pot.

Our spice blend
We won't give you the full recipe — come on, we still have a business to run 😄 — but the short version is: a combination of Nigerian curry, thyme, bay leaves, stock cubes, and one ingredient we'll keep secret for now.

The rice ratio
Too much water and your jollof turns mushy. Too little and it burns before it's cooked. Our ratio took months of testing to perfect. We parboil the rice just enough so it finishes cooking in the sauce, absorbing every bit of flavour along the way.

Why it tastes like a party
Party jollof hits different because it's cooked in large quantities outdoors, slowly, with constant heat management. We've studied that process and worked hard to bring it into our kitchen without losing anything.

Next time you order, close your eyes when you take the first bite. If you don't hear music and smell suya in the air, we haven't done our job right.

Come taste it yourself — we're open every day, 8 AM to 10 PM at 12 Herbert Macaulay Way, Yaba, Lagos. Or just order via WhatsApp 🙌`
  }];
}

function renderBlogPosts(posts){
  const wrap = document.getElementById('blogList');
  if(!posts.length){
    wrap.innerHTML = '<p class="blog-empty">No posts yet — check back soon!</p>';
    return;
  }
  wrap.innerHTML = posts.map(p=>`
    <div class="bcard" onclick="openBlogPost('${p.id}')">
      ${p.cover_image_url ? `<img class="bcard-img" src="${p.cover_image_url}" alt="${esc(p.title)}" onerror="this.style.display='none'"/>` : ''}
      <div class="bcard-body">
        <div class="bcard-title">${p.title}</div>
        <div class="bcard-excerpt">${p.excerpt||''}</div>
      </div>
    </div>`).join('');
}

function openBlogPost(id){
  const post = allBlogPosts.find(p=>String(p.id)===String(id));
  if(!post) return;
  const cover = document.getElementById('readerCover');
  if(post.cover_image_url){
    cover.src = post.cover_image_url; cover.style.display='block';
  } else {
    cover.style.display='none';
  }
  document.getElementById('readerTitle').textContent = post.title;
  const readerContent = document.getElementById('readerContent');
  readerContent.textContent = '';
  (post.content||'').split('\n').forEach((line, i, arr) => {
    readerContent.appendChild(document.createTextNode(line));
    if(i < arr.length - 1) readerContent.appendChild(document.createElement('br'));
  });
  document.getElementById('blogReader').classList.add('show');
  document.getElementById('blogReader').scrollTo(0,0);
  document.body.style.overflow='hidden';
  history.pushState({blogReader: true}, '', '');
}
function closeBlogPost(){
  document.getElementById('blogReader').classList.remove('show');
  document.body.style.overflow='';
}

// ════════════════════════════════════════
// CART
// ════════════════════════════════════════
function addItem(name,price,img){
  const ex = cart.find(i=>i.name===name);
  if(ex) ex.qty++; else cart.push({name,price,img,qty:1});
  syncUI();
  showToast(name+' added');
}
function removeItem(name){
  const idx = cart.findIndex(i=>i.name===name);
  if(idx<0) return;
  if(cart[idx].qty>1) cart[idx].qty--;
  else cart.splice(idx,1);
  syncUI(); renderDrawer();
}
function bumpItem(name,price,img){ addItem(name,price,img); renderDrawer(); }

function syncUI(){
  const n=totalItems(),t=totalPrice();
  const tb=document.getElementById('tbBadge');
  tb.textContent=n; n>0?tb.classList.add('show'):tb.classList.remove('show');
  document.getElementById('floatCount').textContent=n;
  document.getElementById('floatTotal').textContent=fmt(t);
  const fl=document.getElementById('cartFloat');
  n>0?fl.classList.add('up'):fl.classList.remove('up');
}

function renderDrawer(){
  const body=document.getElementById('cartBody');
  const foot=document.getElementById('cartFooter');
  if(!cart.length){
    body.innerHTML=`<div class="empty-cart"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg><p>Your cart is empty</p><small>Add something delicious!</small></div>`;
    foot.innerHTML=''; return;
  }
  body.innerHTML=cart.map(i=>`
    <div class="citem">
      <img class="citem-img" src="${i.img}" alt="${i.name}" onerror="this.style.background='#FFE0CC'"/>
      <div class="citem-info"><div class="citem-name">${i.name}</div><div class="citem-price">${fmt(i.price)} each</div></div>
      <div class="qty-row">
        <button class="qbtn" onclick="removeItem('${esc(i.name)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
        <span class="qnum">${i.qty}</span>
        <button class="qbtn" onclick="bumpItem('${esc(i.name)}',${i.price},'${esc(i.img)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
      </div>
    </div>`).join('');
  foot.innerHTML=`
    <div class="ctotal"><span>Total</span><span>${fmt(totalPrice())}</span></div>
    <button class="btn-full" style="margin-top:14px" onclick="checkout()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.95 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.86 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      Place order via WhatsApp
    </button>`;
}

function openCart(){renderDrawer();document.getElementById('cartOverlay').classList.add('open');document.body.style.overflow='hidden';history.pushState({cart:true},'','');}
function closeCart(){document.getElementById('cartOverlay').classList.remove('open');document.body.style.overflow=''}
function maybeClose(e){if(e.target===document.getElementById('cartOverlay'))closeCart()}

function checkout(){
  const lines=cart.map(i=>`• ${i.name} ×${i.qty} — ${fmt(i.price*i.qty)}`).join('\n');
  const msg=encodeURIComponent(`🍛 *New Isebe Order*\n\n${lines}\n\n*Total: ${fmt(totalPrice())}*\n\nPlease confirm. Thank you!`);
  window.open(`https://wa.me/${whatsappNum}?text=${msg}`,'_blank');
}

function filterCat(el,cat){
  document.querySelectorAll('.cat').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('#menuList .mitem').forEach(m=>{
    m.style.display=(cat==='all'||m.dataset.cat===cat)?'flex':'none';
  });
}
function scrollToMenu(){document.getElementById('menu').scrollIntoView({behavior:'smooth'})}

// ════════════════════════════════════════
// ADMIN AUTH
// ════════════════════════════════════════
let logoTapCount = 0;
let logoTapTimer = null;
function handleLogoTap(){
  logoTapCount++;
  clearTimeout(logoTapTimer);
  logoTapTimer = setTimeout(()=>{ logoTapCount = 0 }, 600);
  if(logoTapCount >= 3){
    logoTapCount = 0;
    clearTimeout(logoTapTimer);
    openAdmin();
  }
}

function openAdmin(){
  document.getElementById('adminPanel').classList.add('show');
  history.pushState({admin:true},'','');
}
function closeAdmin(){
  document.getElementById('adminPanel').classList.remove('show');
}

async function doLogin(){
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPass').value;
  const btn   = document.getElementById('loginBtn');
  const err   = document.getElementById('loginErr');
  if(!email||!pass){err.textContent='Enter email and password.';return}
  btn.disabled=true; btn.textContent='Signing in…'; err.textContent='';
  try {
    await auth.signInWithEmailAndPassword(email, pass);
    showDash();
  } catch(e){
    err.textContent = e.message || 'Login failed. Check credentials.';
    btn.disabled=false; btn.textContent='Sign in';
  }
}

async function doLogout(){
  await auth.signOut();
  document.getElementById('adminDash').style.display='none';
  document.getElementById('adminLogin').style.display='flex';
}

function showDash(){
  document.getElementById('adminLogin').style.display='none';
  document.getElementById('adminDash').style.display='block';
  loadAdminMenuList();
  loadHomepageFields();
  loadAdminBlogList();
}

// ════════════════════════════════════════
// ADMIN TABS
// ════════════════════════════════════════
function showTab(name){
  ['overview','homepage','menu','blog'].forEach(t=>{
    const el=document.getElementById('tab-'+t);
    if(el) el.style.display=t===name?'block':'none';
  });
  document.querySelectorAll('.adm-tab').forEach((btn,i)=>{
    btn.classList.toggle('active',['overview','homepage','menu','blog'][i]===name);
  });
}

// ════════════════════════════════════════
// ADMIN — HOMEPAGE EDITOR
// ════════════════════════════════════════
async function loadHomepageFields(){
  try {
    const snap = await db.collection('site').doc('homepage').get();
    if(!snap.exists) return;
    const d = snap.data();
    document.getElementById('hpTitle').value   = d.hero_title||'';
    document.getElementById('hpSub').value     = d.hero_sub||'';
    document.getElementById('hpTag').value     = d.hero_tag||'';
    document.getElementById('hpEta').value     = d.delivery_eta||'';
    document.getElementById('hpMenuSub').value = d.menu_sub||'';
    document.getElementById('hpLocShort').value= d.loc_short||'';
    document.getElementById('hpLocFull').value = d.loc_full||'';
    document.getElementById('hpCity').value    = d.loc_city||'';
    document.getElementById('hpPhone').value   = d.phone||'';
    document.getElementById('hpWa').value      = d.whatsapp_num||'';
    if(d.hero_image_url){
      const p=document.getElementById('heroImgPreview');
      p.src=d.hero_image_url; p.style.display='block';
    }
  } catch(e){}
}

async function saveHomepage(){
  const btn = document.getElementById('saveHpBtn');
  btn.disabled=true; btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;animation:spin .6s linear infinite"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Saving…';
  const payload = {
    hero_title:   document.getElementById('hpTitle').value,
    hero_sub:     document.getElementById('hpSub').value,
    hero_tag:     document.getElementById('hpTag').value,
    delivery_eta: document.getElementById('hpEta').value,
    menu_sub:     document.getElementById('hpMenuSub').value,
    loc_short:    document.getElementById('hpLocShort').value,
    loc_full:     document.getElementById('hpLocFull').value,
    loc_city:     document.getElementById('hpCity').value,
    phone:        document.getElementById('hpPhone').value,
    whatsapp_num: document.getElementById('hpWa').value,
    updated_at:   firebase.firestore.FieldValue.serverTimestamp(),
  };
  try {
    await db.collection('site').doc('homepage').set(payload, {merge:true});
    showToast('Homepage saved ✓','success');
  } catch(e){
    showToast('Save failed: '+e.message,'error');
  }
  btn.disabled=false;
  btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save homepage';
}

// ── Image upload via Cloudinary (free, no Storage plan needed) ───────────
async function uploadToCloudinary(file, folder){
  if(file.size > 3*1024*1024) throw new Error('Image too large (max 3 MB)');
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUDINARY_PRESET);
  fd.append('folder', folder);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {method:'POST', body:fd});
  if(!res.ok) throw new Error('Cloudinary upload failed');
  const data = await res.json();
  return data.secure_url;
}

// ── Hero image upload ─────────────────────────────────────────────────────
async function uploadHeroImage(input){
  const file = input.files[0];
  if(!file) return;
  const prog = document.getElementById('heroImgProgress');
  const bar  = document.getElementById('heroImgBar');
  const prev = document.getElementById('heroImgPreview');
  prog.classList.add('show'); bar.style.width='40%';
  try {
    const url = await uploadToCloudinary(file, 'isebe/hero');
    bar.style.width='100%';
    await db.collection('site').doc('homepage').set({hero_image_url:url, updated_at:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
    document.getElementById('heroImg').src = url;
    prev.src=url; prev.style.display='block';
    showToast('Hero image uploaded ✓','success');
  } catch(e){
    showToast('Upload failed: '+e.message,'error');
  }
  setTimeout(()=>prog.classList.remove('show'),600);
}

// ════════════════════════════════════════
// ADMIN — MENU ITEMS
// ════════════════════════════════════════
async function loadAdminMenuList(){
  try {
    const snap = await db.collection('menu_items').orderBy('sort_order','asc').get();
    renderAdminMenuList(snap.docs.map(d=>({id:d.id,...d.data()})));
  } catch(e){
    // fallback: try without ordering (index may not exist yet)
    try {
      const snap = await db.collection('menu_items').get();
      renderAdminMenuList(snap.docs.map(d=>({id:d.id,...d.data()})));
    } catch(e2){}
  }
}

function renderAdminMenuList(items){
  const wrap = document.getElementById('admMenuList');
  if(!items.length){wrap.innerHTML='<p style="font-size:13px;color:var(--ink-light)">No items yet. Add one above.</p>';return}
  wrap.innerHTML = items.map(item=>`
    <div class="adm-mitem">
      <img class="adm-mitem-img" src="${item.image_url||''}" alt="${esc(item.name)}" onerror="this.style.background='#FFE0CC'"/>
      <div class="adm-mitem-info">
        <div class="adm-mitem-name">${item.name}</div>
        <div class="adm-mitem-cat">${item.category}${item.featured?' · ⭐ Featured':''}</div>
        <div class="adm-mitem-price">${fmt(item.price)}</div>
      </div>
      <div class="adm-mitem-actions">
        <button class="adm-icon-btn" onclick="editMenuItem(${JSON.stringify(item).replace(/"/g,'&quot;')})" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="adm-icon-btn del" onclick="deleteMenuItem('${item.id}')" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>`).join('');
}

function previewItemImg(input){
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const p = document.getElementById('itemImgPreview');
    p.src=e.target.result; p.style.display='block';
  };
  reader.readAsDataURL(file);
  uploadedItemImgUrl = ''; // Will be set after real upload on save
}

async function saveMenuItem(){
  const name  = document.getElementById('itemName').value.trim();
  const price = parseInt(document.getElementById('itemPrice').value);
  const cat   = document.getElementById('itemCat').value;
  const desc  = document.getElementById('itemDesc').value.trim();
  const feat  = document.getElementById('itemFeatured').checked;
  const urlIn = document.getElementById('itemImgUrl').value.trim();

  if(!name||!price){showToast('Name and price required','error');return}

  const btn = document.getElementById('saveItemBtn');
  btn.disabled=true;

  try {
    let imgUrl = urlIn || uploadedItemImgUrl || '';

    // If a file was selected, upload it now
    const fileInput = document.getElementById('itemImgInput');
    if(fileInput.files[0] && !uploadedItemImgUrl){
      const file = fileInput.files[0];
      const prog = document.getElementById('itemImgProgress');
      const bar  = document.getElementById('itemImgBar');
      prog.classList.add('show'); bar.style.width='40%';
      try {
        imgUrl = await uploadToCloudinary(file, 'isebe/menu');
        bar.style.width='100%';
      } catch(e){ showToast('Image upload failed: '+e.message,'error'); btn.disabled=false; prog.classList.remove('show'); return; }
      setTimeout(()=>prog.classList.remove('show'),600);
    }

    const payload = {name, price, category:cat, description:desc, featured:feat, image_url:imgUrl, active:true, sort_order: Date.now(), updated_at:firebase.firestore.FieldValue.serverTimestamp()};

    if(editingItemId){
      await db.collection('menu_items').doc(editingItemId).update(payload);
      showToast('Item updated ✓','success');
    } else {
      await db.collection('menu_items').add(payload);
      showToast('Item added ✓','success');
    }

    clearItemForm();
    loadAdminMenuList();
    // Real-time Firestore listener refreshes the customer menu automatically
  } catch(e){
    showToast('Error: '+e.message,'error');
  }
  btn.disabled=false;
}

function editMenuItem(item){
  editingItemId = item.id;
  document.getElementById('itemName').value  = item.name||'';
  document.getElementById('itemPrice').value = item.price||'';
  document.getElementById('itemCat').value   = item.category||'mains';
  document.getElementById('itemDesc').value  = item.description||'';
  document.getElementById('itemImgUrl').value= item.image_url||'';
  document.getElementById('itemFeatured').checked = !!item.featured;
  if(item.image_url){
    const p = document.getElementById('itemImgPreview');
    p.src=item.image_url; p.style.display='block';
  }
  document.getElementById('saveItemBtnTxt').textContent='Update item';
  document.getElementById('menuFormTitle').textContent='Edit Item';
  document.querySelector('#tab-menu .add-item-form').scrollIntoView({behavior:'smooth'});
}

function clearItemForm(){
  editingItemId = null;
  uploadedItemImgUrl='';
  document.getElementById('editItemId').value='';
  document.getElementById('itemName').value='';
  document.getElementById('itemPrice').value='';
  document.getElementById('itemCat').value='mains';
  document.getElementById('itemDesc').value='';
  document.getElementById('itemImgUrl').value='';
  document.getElementById('itemFeatured').checked=false;
  const p=document.getElementById('itemImgPreview');
  p.src=''; p.style.display='none';
  document.getElementById('itemImgInput').value='';
  document.getElementById('saveItemBtnTxt').textContent='Add item';
  document.getElementById('menuFormTitle').textContent='Add / Edit Item';
}

async function deleteMenuItem(id){
  if(!confirm('Delete this item? This cannot be undone.')) return;
  try {
    await db.collection('menu_items').doc(id).update({active:false});
    showToast('Item deleted','success');
    loadAdminMenuList();
  } catch(e){
    showToast('Error: '+e.message,'error');
  }
}

// ════════════════════════════════════════
// ADMIN — BLOG
// ════════════════════════════════════════
async function loadAdminBlogList(){
  try {
    const snap = await db.collection('blog_posts').orderBy('created_at','desc').get();
    renderAdminBlogList(snap.docs.map(d=>({id:d.id,...d.data()})));
  } catch(e){
    try {
      const snap = await db.collection('blog_posts').get();
      renderAdminBlogList(snap.docs.map(d=>({id:d.id,...d.data()})));
    } catch(e2){ renderAdminBlogList([]); }
  }
}

function renderAdminBlogList(posts){
  const wrap = document.getElementById('admBlogList');
  if(!posts.length){wrap.innerHTML='<p style="font-size:13px;color:var(--ink-light)">No posts yet. Write one above.</p>';return}
  wrap.innerHTML = posts.map(p=>`
    <div class="adm-mitem">
      ${p.cover_image_url
        ? `<img class="adm-mitem-img" src="${p.cover_image_url}" alt="${esc(p.title)}" onerror="this.style.background='#FFE0CC'"/>`
        : `<div class="adm-mitem-img" style="display:flex;align-items:center;justify-content:center;color:var(--ink-light)"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></div>`}
      <div class="adm-mitem-info">
        <div class="adm-mitem-name">${p.title}</div>
        <span class="status-pill ${p.published?'live':'draft'}">${p.published?'Published':'Draft'}</span>
      </div>
      <div class="adm-mitem-actions">
        <button class="adm-icon-btn" onclick='editBlogPost(${JSON.stringify(p).replace(/'/g,"&#39;")})' title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="adm-icon-btn del" onclick="deleteBlogPost('${p.id}')" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>`).join('');
}

function previewPostImg(input){
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const p = document.getElementById('postImgPreview');
    p.src=e.target.result; p.style.display='block';
  };
  reader.readAsDataURL(file);
  uploadedPostImgUrl = '';
}

async function saveBlogPost(){
  const title   = document.getElementById('postTitle').value.trim();
  const excerpt = document.getElementById('postExcerpt').value.trim();
  const content = document.getElementById('postContent').value.trim();
  const urlIn   = document.getElementById('postImgUrl').value.trim();
  const published = document.getElementById('postPublished').checked;

  if(!title||!content){showToast('Title and content required','error');return}

  const btn = document.getElementById('savePostBtn');
  btn.disabled=true;

  try {
    let imgUrl = urlIn || uploadedPostImgUrl || '';

    const fileInput = document.getElementById('postImgInput');
    if(fileInput.files[0] && !uploadedPostImgUrl){
      const file = fileInput.files[0];
      const prog = document.getElementById('postImgProgress');
      const bar  = document.getElementById('postImgBar');
      prog.classList.add('show'); bar.style.width='40%';
      try {
        imgUrl = await uploadToCloudinary(file, 'isebe/blog');
        bar.style.width='100%';
      } catch(e){ showToast('Image upload failed: '+e.message,'error'); btn.disabled=false; prog.classList.remove('show'); return; }
      setTimeout(()=>prog.classList.remove('show'),600);
    }

    const payload = {title, excerpt, content, cover_image_url:imgUrl, published, updated_at:firebase.firestore.FieldValue.serverTimestamp()};

    if(editingPostId){
      await db.collection('blog_posts').doc(editingPostId).update(payload);
      showToast('Post updated ✓','success');
    } else {
      await db.collection('blog_posts').add({...payload, created_at:firebase.firestore.FieldValue.serverTimestamp()});
      showToast('Post saved ✓','success');
    }

    clearPostForm();
    loadAdminBlogList();
    // Real-time listener refreshes customer blog view automatically
  } catch(e){
    showToast('Error: '+e.message,'error');
  }
  btn.disabled=false;
}

function editBlogPost(post){
  editingPostId = post.id;
  document.getElementById('postTitle').value   = post.title||'';
  document.getElementById('postExcerpt').value = post.excerpt||'';
  document.getElementById('postContent').value = post.content||'';
  document.getElementById('postImgUrl').value  = post.cover_image_url||'';
  document.getElementById('postPublished').checked = !!post.published;
  if(post.cover_image_url){
    const p = document.getElementById('postImgPreview');
    p.src=post.cover_image_url; p.style.display='block';
  }
  document.getElementById('savePostBtnTxt').textContent='Update post';
  document.getElementById('blogFormTitle').textContent='Edit Post';
  document.querySelector('#tab-blog .add-item-form').scrollIntoView({behavior:'smooth'});
}

function clearPostForm(){
  editingPostId = null;
  uploadedPostImgUrl='';
  document.getElementById('editPostId').value='';
  document.getElementById('postTitle').value='';
  document.getElementById('postExcerpt').value='';
  document.getElementById('postContent').value='';
  document.getElementById('postImgUrl').value='';
  document.getElementById('postPublished').checked=true;
  const p=document.getElementById('postImgPreview');
  p.src=''; p.style.display='none';
  document.getElementById('postImgInput').value='';
  document.getElementById('savePostBtnTxt').textContent='Publish post';
  document.getElementById('blogFormTitle').textContent='New Post';
}

async function deleteBlogPost(id){
  if(!confirm('Delete this post? This cannot be undone.')) return;
  try {
    await db.collection('blog_posts').doc(id).delete();
    showToast('Post deleted','success');
    loadAdminBlogList();
  } catch(e){
    showToast('Error: '+e.message,'error');
  }
}
</script>

<!-- Spin animation for save button -->
<style>
@keyframes spin{to{transform:rotate(360deg)}}
</style>

<!-- ═══════════════════════════════════════
     PRIVACY POLICY PANEL
═══════════════════════════════════════ -->
<div id="legalPrivacy" class="legal-panel">
  <div class="legal-topbar">
    <button class="legal-back" onclick="closeLegal('privacy')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    </button>
    <span class="legal-back-label">Back</span>
  </div>
  <div class="legal-body">
    <h1 class="legal-title">Privacy Policy</h1>
    <p class="legal-updated">Last updated: June 2026</p>

    <div class="legal-section">
      <h2 class="legal-h2">1. Who We Are</h2>
      <p class="legal-p">Isebe is a Lagos-based food brand offering authentic Nigerian cuisine for dine-in and delivery. Our website and ordering platform are operated by Isebe and powered by BeepeeLabs. This Privacy Policy explains how we collect, use, and protect your personal information when you use our services.</p>
    </div>

    <div class="legal-section">
      <h2 class="legal-h2">2. Information We Collect</h2>
      <p class="legal-p">When you place an order or interact with our platform, we may collect:</p>
      <ul class="legal-ul">
        <li>Your name and contact details (phone number, WhatsApp)</li>
        <li>Delivery address and location information</li>
        <li>Order history and food preferences</li>
        <li>Device information and browsing behaviour on our site</li>
        <li>Payment references (we do not store full card details)</li>
      </ul>
    </div>

    <div class="legal-section">
      <h2 class="legal-h2">3. How We Use Your Information</h2>
      <p class="legal-p">We use your information to:</p>
      <ul class="legal-ul">
        <li>Process and fulfil your food orders</li>
        <li>Contact you via WhatsApp or phone regarding your order</li>
        <li>Improve our menu, service quality, and user experience</li>
        <li>Send occasional promotions (only if you have opted in)</li>
        <li>Comply with applicable Nigerian laws and regulations</li>
      </ul>
    </div>

    <div class="legal-section">
      <h2 class="legal-h2">4. Data Sharing</h2>
      <p class="legal-p">We do not sell your personal data. We only share it with trusted third parties where necessary — such as our delivery partners to complete your order — and only to the extent required. All partners are required to handle your data securely.</p>
    </div>

    <div class="legal-section">
      <h2 class="legal-h2">5. Data Retention</h2>
      <p class="legal-p">We retain your order and contact information for up to 12 months for service continuity and records purposes. You may request deletion of your data at any time by contacting us.</p>
    </div>

    <div class="legal-section">
      <h2 class="legal-h2">6. Your Rights</h2>
      <p class="legal-p">You have the right to access, correct, or request deletion of any personal data we hold about you. To exercise these rights, please contact us via WhatsApp or email.</p>
    </div>

    <div class="legal-section">
      <h2 class="legal-h2">7. Cookies</h2>
      <p class="legal-p">Our site may use basic local storage and session data to maintain your cart and preferences during your visit. We do not use third-party tracking cookies for advertising.</p>
    </div>

    <div class="legal-section">
      <h2 class="legal-h2">8. Contact</h2>
      <p class="legal-p">For any privacy-related questions, please reach us at: <strong>hello@isebe.ng</strong> or via our WhatsApp order line.</p>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════
     TERMS & CONDITIONS PANEL
═══════════════════════════════════════ -->
<div id="legalTerms" class="legal-panel">
  <div class="legal-topbar">
    <button class="legal-back" onclick="closeLegal('terms')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    </button>
    <span class="legal-back-label">Back</span>
  </div>
  <div class="legal-body">
    <h1 class="legal-title">Terms & Conditions</h1>
    <p class="legal-updated">Last updated: June 2026</p>

    <div class="legal-section">
      <h2 class="legal-h2">1. Acceptance of Terms</h2>
      <p class="legal-p">By accessing or using the Isebe website and placing orders through our platform, you agree to be bound by these Terms and Conditions. If you do not agree, please do not use our service.</p>
    </div>

    <div class="legal-section">
      <h2 class="legal-h2">2. Ordering</h2>
      <p class="legal-p">All orders placed through our platform are subject to availability and confirmation. By submitting an order, you are making an offer to purchase, which becomes binding once we confirm via WhatsApp. We reserve the right to refuse or cancel orders at our discretion.</p>
    </div>

    <div class="legal-section">
      <h2 class="legal-h2">3. Pricing</h2>
      <p class="legal-p">All prices are listed in Nigerian Naira (₦) and are inclusive of applicable taxes. Prices are subject to change without prior notice. The price displayed at the time of your order is the price that applies to that transaction.</p>
    </div>

    <div class="legal-section">
      <h2 class="legal-h2">4. Payment</h2>
      <p class="legal-p">We accept payment via bank transfer and other methods communicated at checkout. Payment must be confirmed before order preparation begins. We are not responsible for delays caused by incomplete or failed payment transfers.</p>
    </div>

    <div class="legal-section">
      <h2 class="legal-h2">5. Delivery</h2>
      <ul class="legal-ul">
        <li>Estimated delivery times are 20–45 minutes depending on location and demand.</li>
        <li>Delivery is available within our operational zones in Lagos.</li>
        <li>We are not liable for delays caused by traffic, weather, or circumstances beyond our control.</li>
        <li>You are responsible for providing an accurate delivery address.</li>
      </ul>
    </div>

    <div class="legal-section">
      <h2 class="legal-h2">6. Cancellations & Refunds</h2>
      <p class="legal-p">Orders may only be cancelled before preparation begins. Once preparation has started, cancellations are not accepted. If you receive an incorrect or damaged order, please contact us via WhatsApp within 30 minutes of delivery for resolution. Refunds, where applicable, will be processed within 3–5 business days.</p>
    </div>

    <div class="legal-section">
      <h2 class="legal-h2">7. Food Allergies</h2>
      <p class="legal-p">Our kitchen handles common allergens including nuts, gluten, dairy, and seafood. While we take care to avoid cross-contamination, we cannot guarantee a fully allergen-free environment. Please inform us of any dietary restrictions before ordering.</p>
    </div>

    <div class="legal-section">
      <h2 class="legal-h2">8. Operating Hours</h2>
      <p class="legal-p">We are open every day of the week, Monday to Sunday, from 8:00 AM to 10:00 PM. Orders placed outside these hours will be processed on the next available day.</p>
    </div>

    <div class="legal-section">
      <h2 class="legal-h2">9. Limitation of Liability</h2>
      <p class="legal-p">Isebe shall not be liable for any indirect, incidental, or consequential damages arising from the use of our services. Our total liability in any circumstance is limited to the value of the specific order in question.</p>
    </div>

    <div class="legal-section">
      <h2 class="legal-h2">10. Changes to Terms</h2>
      <p class="legal-p">We reserve the right to update these Terms at any time. Continued use of our platform after changes constitutes your acceptance of the revised Terms.</p>
    </div>

    <div class="legal-section">
      <h2 class="legal-h2">11. Governing Law</h2>
      <p class="legal-p">These Terms are governed by the laws of the Federal Republic of Nigeria. Any disputes shall be resolved under the jurisdiction of Nigerian courts.</p>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════
     FAQ PANEL
═══════════════════════════════════════ -->
<div id="legalFaq" class="legal-panel">
  <div class="legal-topbar">
    <button class="legal-back" onclick="closeLegal('faq')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    </button>
    <span class="legal-back-label">Back</span>
  </div>
  <div class="legal-body">
    <h1 class="legal-title">FAQ</h1>
    <p class="legal-updated">Frequently Asked Questions</p>

    <div class="faq-item">
      <button class="faq-q" onclick="toggleFaq(this)">
        What are your opening hours?
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="faq-a">We are open every day — Monday to Sunday — from 8:00 AM to 10:00 PM. Last orders are accepted at 9:30 PM to allow preparation time.</div>
    </div>

    <div class="faq-item">
      <button class="faq-q" onclick="toggleFaq(this)">
        How do I place an order?
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="faq-a">Browse our menu, add your desired items to the cart, then tap "Place order via WhatsApp". Your order summary will be sent directly to our team on WhatsApp to confirm and process.</div>
    </div>

    <div class="faq-item">
      <button class="faq-q" onclick="toggleFaq(this)">
        What areas do you deliver to?
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="faq-a">We currently deliver within Yaba, Surulere, Ikorodu Road, Maryland, Ikeja and select surrounding areas of Lagos. Contact us on WhatsApp to confirm if your location is within our delivery zone.</div>
    </div>

    <div class="faq-item">
      <button class="faq-q" onclick="toggleFaq(this)">
        How long does delivery take?
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="faq-a">Our estimated delivery time is 20–45 minutes depending on your location and current order volume. Peak hours (12 PM–2 PM and 6 PM–9 PM) may experience slight delays. We'll keep you updated via WhatsApp.</div>
    </div>

    <div class="faq-item">
      <button class="faq-q" onclick="toggleFaq(this)">
        What payment methods do you accept?
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="faq-a">We accept bank transfers and other payment options shared at checkout on WhatsApp. Payment must be confirmed before we begin preparing your order.</div>
    </div>

    <div class="faq-item">
      <button class="faq-q" onclick="toggleFaq(this)">
        Can I cancel or modify my order?
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="faq-a">You can cancel or modify your order before preparation begins. Once our team has started cooking your food, we are unable to accept changes or cancellations. Please contact us on WhatsApp as quickly as possible.</div>
    </div>

    <div class="faq-item">
      <button class="faq-q" onclick="toggleFaq(this)">
        My order was wrong or missing items — what do I do?
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="faq-a">We're sorry about that! Please reach out via WhatsApp within 30 minutes of receiving your order. Send a photo of what you received and we'll work quickly to make it right — either with a replacement or a refund.</div>
    </div>

    <div class="faq-item">
      <button class="faq-q" onclick="toggleFaq(this)">
        Do you cater for allergies or dietary restrictions?
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="faq-a">Please inform us of any dietary restrictions or allergies when placing your order. We'll do our best to accommodate. However, our kitchen handles common allergens (nuts, gluten, dairy, seafood) and we cannot guarantee a fully allergen-free environment.</div>
    </div>

    <div class="faq-item">
      <button class="faq-q" onclick="toggleFaq(this)">
        Do you offer bulk or event catering?
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="faq-a">Yes! We love catering for events, parties, and corporate orders. Contact us on WhatsApp with your event date, expected guest count, and preferred menu so we can put together the best package for you.</div>
    </div>

    <div class="faq-item">
      <button class="faq-q" onclick="toggleFaq(this)">
        How do I contact Isebe?
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="faq-a">The fastest way to reach us is via WhatsApp using the order button on this site. You can also visit us at 12 Herbert Macaulay Way, Yaba, Lagos. We're here every day from 8:00 AM to 10:00 PM.</div>
    </div>
  </div>
</div>

<script>
// ── Legal panels with phone back-button support ──
const LEGAL_IDS = {privacy:'legalPrivacy', terms:'legalTerms', faq:'legalFaq'};

function openLegal(type){
  const el = document.getElementById(LEGAL_IDS[type]);
  if(!el) return;
  el.classList.add('show');
  el.scrollTop = 0;
  document.body.style.overflow = 'hidden';
  // Push a history state so the phone back button can close the panel
  history.pushState({legalPanel: type}, '', '');
}

function closeLegal(type){
  const el = document.getElementById(LEGAL_IDS[type]);
  if(!el) return;
  el.classList.remove('show');
  document.body.style.overflow = '';
}

function closeAllLegal(){
  Object.values(LEGAL_IDS).forEach(id => {
    const el = document.getElementById(id);
    if(el) el.classList.remove('show');
  });
  document.body.style.overflow = '';
}

// ── Unified back-button handler ───────────────────────────────────────────
window.addEventListener('popstate', function(e){
  // 1. Admin panel
  if(document.getElementById('adminPanel')?.classList.contains('show')){
    closeAdmin();
    return;
  }
  // 2. Blog reader
  if(document.getElementById('blogReader')?.classList.contains('show')){
    closeBlogPost();
    return;
  }
  // 3. Cart drawer
  if(document.getElementById('cartOverlay')?.classList.contains('open')){
    closeCart();
    return;
  }
  // 4. Legal panels
  const anyOpen = Object.values(LEGAL_IDS).some(id =>
    document.getElementById(id)?.classList.contains('show')
  );
  if(anyOpen){
    closeAllLegal();
  }
});

function toggleFaq(btn){
  const ans = btn.nextElementSibling;
  const isOpen = ans.classList.contains('show');
  document.querySelectorAll('.faq-a').forEach(a => a.classList.remove('show'));
  document.querySelectorAll('.faq-q').forEach(q => q.classList.remove('open'));
  if(!isOpen){ ans.classList.add('show'); btn.classList.add('open'); }
}