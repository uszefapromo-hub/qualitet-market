document.addEventListener('DOMContentLoaded', () => {
  if(!window.QM) return;
  const listEl = document.getElementById('supplier-list');
  const statusEl = document.getElementById('import-status');
  const uploadInput = document.getElementById('csv-upload');
  const importBtn = document.getElementById('import-default-products');

  const suppliers = ['AliExpress','CJ Dropshipping','EPROLO','VidaXL','Banggood','Costway','BigBuy','Hertwill'];

  if(listEl){
    listEl.innerHTML = suppliers.map(name => `
      <div class="list-item">
        <div>
          <strong>${name}</strong>
          <div class="small">Gotowe pod import do qm_products_by_supplier_v1</div>
        </div>
        <span class="store-pill">Supplier</span>
      </div>
    `).join('');
  }

  function setStatus(msg, type){
    if(!statusEl) return;
    statusEl.className = 'notice ' + (type || '');
    statusEl.textContent = msg;
  }

  if(importBtn){
    importBtn.addEventListener('click', () => {
      const demo = QM.getProducts();
      QM.setProducts(demo);
      setStatus('Zaimportowano domyślne produkty do qm_products_by_supplier_v1', 'success');
    });
  }

  if(uploadInput){
    uploadInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if(!file) return;
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(Boolean);
      if(lines.length < 2){
        setStatus('CSV jest pusty albo ma zły format.', 'red');
        return;
      }
      const headers = lines[0].split(',').map(v => v.trim().toLowerCase());
      const nameIdx = headers.indexOf('name');
      const priceIdx = headers.indexOf('price');
      const imgIdx = headers.indexOf('img');
      const supplierIdx = headers.indexOf('supplier');
      const categoryIdx = headers.indexOf('category');

      const products = lines.slice(1).map((line, i) => {
        const cols = line.split(',').map(v => v.trim());
        return {
          id: 'csv-' + (i+1),
          name: cols[nameIdx] || ('Produkt ' + (i+1)),
          price: Number(cols[priceIdx] || 0),
          img: cols[imgIdx] || '📦',
          supplier: cols[supplierIdx] || 'CSV',
          category: cols[categoryIdx] || 'CSV'
        };
      }).filter(p => p.name);

      QM.setProducts(products);
      setStatus('CSV zaimportowany. Produktów: ' + products.length, 'success');
    });
  }

  const sampleBtn = document.getElementById('download-sample-csv');
  if(sampleBtn){
    sampleBtn.addEventListener('click', () => {
      const csv = 'name,price,img,supplier,category\nLampa loft,129,💡,VidaXL,Dom\nPowerbank,149,🔋,Banggood,Elektronika\nProjektor mini,239,📽️,CJ Dropshipping,Elektronika';
      const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'qm-sample-products.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }
});
