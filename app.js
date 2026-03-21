const API_URL = 'https://dummyjson.com/products';
let products=[];
let cart=[];

async function loadProducts(){
  const el = document.getElementById('products');
  el.innerHTML='Ładowanie...';

  try{
    const res = await fetch(API_URL);
    const data = await res.json();
    products = data.products;
  }catch(e){
    products = [
      {id:1,title:'Produkt lokalny',price:100,thumbnail:''}
    ];
  }

  render(products);
}

function render(list){
  const el = document.getElementById('products');
  el.innerHTML = list.map(p=>`
    <div class="card">
      <h3>${p.title}</h3>
      <p>${p.price} zł</p>
      <button onclick="add(${p.id})">Dodaj</button>
    </div>
  `).join('');
}

function add(id){
  const p = products.find(x=>x.id==id);
  cart.push(p);
  renderCart();
}

function renderCart(){
  const el = document.getElementById('cart');
  el.innerHTML = cart.map(p=>`<div>${p.title}</div>`).join('');
}

document.getElementById('search').addEventListener('input',e=>{
  const q=e.target.value.toLowerCase();
  render(products.filter(p=>p.title.toLowerCase().includes(q)));
});

function scrollToCart(){
  document.getElementById('cart').scrollIntoView();
}

loadProducts();
