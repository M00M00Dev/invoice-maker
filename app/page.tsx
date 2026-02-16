'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Trash2, Plus, Upload, Download, Users 
} from 'lucide-react';

// --- Interfaces & Types ---

interface Customer {
  id: number;
  displayName: string;
  nameLine1: string;
  nameLine2: string;
  addressLine1: string;
  addressLine2: string;
}

interface InvoiceItem {
  id: number;
  description: string;
  date: string;
  reference: string;
  amount: number | string;
}

// --- Main Application ---

export default function InvoiceGenerator() {
  const [isLibraryLoaded, setIsLibraryLoaded] = useState(false);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);

  // Load html2pdf library
  useEffect(() => {
    if (document.getElementById('html2pdf-lib')) { setIsLibraryLoaded(true); return; }
    const script = document.createElement('script');
    script.id = 'html2pdf-lib';
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => setIsLibraryLoaded(true);
    document.body.appendChild(script);
  }, []);

  const customers: Customer[] = [
    { 
      id: 1, 
      displayName: "Quest Frankston on the Bay", 
      nameLine1: "Quest Frankston", 
      nameLine2: "on the Bay", 
      addressLine1: "435 Nepean Hwy", 
      addressLine2: "Frankston VIC 3199" 
    },
    { 
      id: 2, 
      displayName: "MEEKHUN PTY LTD", 
      nameLine1: "MEEKHUN PTY LTD", 
      nameLine2: "", 
      addressLine1: "77 Harrison Dr", 
      addressLine2: "Noble Park VIC 3174" 
    }
  ];

  // State
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: 1, description: 'Chargeback', date: '', reference: '', amount: 143.48 }
  ]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(customers[0].id);
  const [invoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [isDownloading, setIsDownloading] = useState(false);

  // Derived State
  const currentCustomer = customers.find(c => c.id === selectedCustomerId) || customers[0];
  const isMeekhun = currentCustomer.id === 2;

  // AUTO LOGO LOGIC
  useEffect(() => {
    if (selectedCustomerId === 1) {
      setLogoSrc('/pad-logo.png'); 
    } else {
      setLogoSrc(null);
    }
  }, [selectedCustomerId]);

  const totalGross = items.reduce((acc, item) => acc + (parseFloat(item.amount.toString()) || 0), 0);
  
  const formatCurrency = (val: number | string) => 
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Number(val));

  const handleDownload = () => {
    const html2pdf = (window as any).html2pdf;
    if (!html2pdf) return;
    
    setIsDownloading(true);
    const element = document.getElementById('invoice-pdf');
    const opt = { 
      margin: 0, 
      filename: `Invoice_${currentCustomer.nameLine1.replace(/\s+/g, '_')}_${Date.now()}.pdf`, 
      image: { type: 'jpeg', quality: 0.98 }, 
      html2canvas: { scale: 2, useCORS: true }, 
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
    };
    
    html2pdf().set(opt).from(element).save()
      .then(() => setIsDownloading(false))
      .catch(() => setIsDownloading(false));
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 font-sans text-gray-900">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
      `}</style>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* Editor Panel */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6">
          <div className="flex justify-between items-center border-b border-gray-100 pb-4">
            <h1 className="text-xl font-bold text-gray-800">Invoice Editor</h1>
            <div className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold uppercase tracking-wider">
              {selectedCustomerId === 1 ? 'Quest Mode' : 'Meekhun Mode'}
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
              <Users className="w-3 h-3" /> Select Recipient
            </label>
            <select 
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
              className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
            >
              {customers.map(c => <option key={c.id} value={c.id}>{c.displayName}</option>)}
            </select>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-gray-400 uppercase">Items</label>
              <button 
                onClick={() => setItems([...items, { id: Date.now(), description: isMeekhun ? 'Rent' : 'Chargeback', date: '', reference: '', amount: 0 }])} 
                className="text-blue-600 text-xs font-bold flex items-center gap-1 hover:underline"
              >
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>
            
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="p-3 border border-gray-100 bg-gray-50 rounded-xl flex gap-3 items-center">
                  <input 
                    value={item.description} 
                    onChange={e => setItems(items.map(i => i.id === item.id ? {...i, description: e.target.value} : i))} 
                    className="flex-1 bg-transparent border-none text-sm outline-none font-medium" 
                    placeholder="Description"
                  />
                  <div className="relative">
                    <span className="absolute left-2 top-2 text-gray-400 text-xs">$</span>
                    <input 
                      type="number" 
                      value={item.amount} 
                      onChange={e => setItems(items.map(i => i.id === item.id ? {...i, amount: e.target.value} : i))} 
                      className="w-24 bg-white border border-gray-200 rounded px-2 py-1 pl-4 text-sm text-right font-bold outline-none focus:ring-1 focus:ring-blue-400" 
                    />
                  </div>
                  <button 
                    onClick={() => setItems(items.filter(i => i.id !== item.id))} 
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button 
            onClick={handleDownload}
            disabled={!isLibraryLoaded || isDownloading}
            className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-gray-200 ${
              isLibraryLoaded && !isDownloading 
              ? 'bg-gray-900 text-white hover:bg-black active:scale-[0.98]' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Download className="w-5 h-5" /> 
            {isDownloading ? 'Generating PDF...' : 'Download Invoice'}
          </button>
        </div>

        {/* Preview Panel */}
        <div className="bg-white p-4 rounded-2xl shadow-xl border border-gray-100 overflow-auto">
          <div id="invoice-pdf" className="w-[210mm] h-[297mm] bg-white mx-auto p-16 text-gray-800 flex flex-col justify-between shrink-0">
            <div>
              {/* Header */}
              <div className="flex justify-between items-start mb-16">
                <h1 className="text-6xl font-black text-gray-900 tracking-tighter">INVOICE</h1>
                <div className="w-48 h-24 flex items-center justify-end">
                  {logoSrc && (
                    <img 
                      src={logoSrc} 
                      alt="Logo" 
                      className="max-h-full object-contain" 
                      onError={() => setLogoSrc(null)} 
                    />
                  )}
                </div>
              </div>

              {/* Address Grid */}
              <div className="grid grid-cols-2 gap-16 mb-16">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-3 tracking-widest">Issued By</p>
                  <div className="text-sm">
                    <p className="text-gray-900 font-black text-base mb-1">Chaitawat P</p>
                    <p className="text-gray-500 font-medium">120 Lindrum Road</p>
                    <p className="text-gray-500 font-medium">Frankston VIC 3199</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-3 tracking-widest">Billed To</p>
                  <div className="text-sm">
                    <p className="text-gray-900 font-black text-base mb-1">{currentCustomer.nameLine1}</p>
                    {currentCustomer.nameLine2 && <p className="text-gray-900 font-black text-base mb-1">{currentCustomer.nameLine2}</p>}
                    <p className="text-gray-500 font-medium">{currentCustomer.addressLine1}</p>
                    <p className="text-gray-500 font-medium">{currentCustomer.addressLine2}</p>
                  </div>
                </div>
              </div>

              {/* Subject & Date */}
              <div className="grid grid-cols-2 gap-8 mb-12 py-6 border-y border-gray-100">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-widest">Subject</p>
                  <p className="text-lg font-black text-gray-900">{isMeekhun ? "Rent" : "Chargeback from PAD Thai Food"}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-widest">Invoice Date</p>
                  <p className="text-lg font-black text-gray-900">{invoiceDate}</p>
                </div>
              </div>

              {/* Table */}
              <table className="w-full mb-12">
                <thead>
                  <tr className="border-b-2 border-gray-900">
                    <th className="py-4 text-[10px] font-bold text-gray-400 uppercase text-left tracking-widest">Description</th>
                    <th className="py-4 text-[10px] font-bold text-gray-400 uppercase text-right tracking-widest">Unit Price</th>
                    <th className="py-4 text-[10px] font-bold text-gray-400 uppercase text-right tracking-widest">GST</th>
                    <th className="py-4 text-[10px] font-bold text-gray-400 uppercase text-right tracking-widest">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map(item => {
                    const amt = parseFloat(item.amount.toString()) || 0;
                    const gst = isMeekhun ? 0 : amt / 11;
                    return (
                      <tr key={item.id}>
                        <td className="py-5 text-sm font-black text-gray-900">{item.description}</td>
                        <td className="py-5 text-sm text-right font-medium text-gray-500">{formatCurrency(amt)}</td>
                        <td className="py-5 text-sm text-right font-medium text-gray-500">{formatCurrency(gst)}</td>
                        <td className="py-5 text-sm text-right font-black text-gray-900">{formatCurrency(amt)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Grand Total */}
              <div className="flex justify-end pt-8 border-t-2 border-gray-900">
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-widest">Grand Total Due</p>
                  <p className="text-5xl font-black text-gray-900">{formatCurrency(totalGross)}</p>
                </div>
              </div>
            </div>

            {/* Footer / Bank Info */}
            <div className="bg-[#0F172A] p-10 text-white rounded-3xl">
              <p className="text-[10px] font-bold text-blue-400 uppercase mb-6 tracking-[0.2em]">Remittance / Bank Details</p>
              <div className="grid grid-cols-2 gap-y-6 gap-x-12 text-xs">
                <div>
                  <p className="text-gray-500 mb-1 font-bold uppercase tracking-wider">Account Name</p>
                  <p className="font-black text-sm">Chaitawat Poovaviranon</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1 font-bold uppercase tracking-wider">ABN</p>
                  <p className="font-black text-sm">38 496 177 905</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1 font-bold uppercase tracking-wider">BSB</p>
                  <p className="font-black text-sm tracking-widest">063-607</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1 font-bold uppercase tracking-wider">Account Number</p>
                  <p className="font-black text-sm tracking-widest">1085 5707</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}