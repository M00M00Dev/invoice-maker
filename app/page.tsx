/** * Invoice Generator
 * Version: 2602161528
 */
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Plus, Upload, Download, Users, AlertCircle, CheckCircle2 } from 'lucide-react';

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
  const [libraryError, setLibraryError] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: 1, description: 'Chargeback', date: '', reference: '', amount: 143.48 }
  ]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(1);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Static Data
  const [invoiceDate] = useState(new Date().toISOString().split('T')[0]);
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // 1. Load PDF Library
  useEffect(() => {
    if (document.getElementById('html2pdf-lib')) {
      setIsLibraryLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'html2pdf-lib';
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.async = true;
    script.onload = () => setIsLibraryLoaded(true);
    script.onerror = () => {
      setLibraryError(true);
      console.error("Failed to load html2pdf.js library");
    };
    document.body.appendChild(script);
  }, []);

  // 2. Auto Logo Logic
  useEffect(() => {
    if (selectedCustomerId === 1) {
      setLogoSrc('/pad-logo.png');
    } else {
      setLogoSrc(null);
    }
  }, [selectedCustomerId]);

  const currentCustomer = customers.find(c => c.id === selectedCustomerId) || customers[0];
  const isMeekhun = currentCustomer.id === 2;
  const totalGross = items.reduce((acc, item) => acc + (parseFloat(item.amount.toString()) || 0), 0);
  
  const formatCurrency = (val: number | string) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(isNaN(num) ? 0 : num);
  };

  const addNewItem = () => {
    setItems([...items, {
      id: Date.now(),
      description: isMeekhun ? 'Rent' : 'New Item',
      date: '',
      reference: '',
      amount: 0
    }]);
  };

  const removeItem = (id: number) => setItems(items.filter(item => item.id !== id));

  const updateItem = (id: number, field: keyof InvoiceItem, value: string | number) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const newItems = files.map((file, index) => ({
        id: Date.now() + index,
        description: `File: ${file.name}`,
        date: new Date().toISOString().split('T')[0],
        reference: '',
        amount: 0 
      }));
      setItems([...items, ...newItems]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (typeof event.target?.result === 'string') setLogoSrc(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownloadPDF = async () => {
    const html2pdf = (window as any).html2pdf;
    if (!html2pdf) {
      alert("PDF library not ready yet. Please wait a moment or refresh.");
      return;
    }
    
    setIsDownloading(true);
    const element = document.getElementById('invoice-preview');
    
    const opt = {
      margin: 0,
      filename: `Invoice_${currentCustomer.nameLine1.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        allowTaint: true,
        letterRendering: true,
        scrollY: 0,
        scrollX: 0
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error('PDF Generation Error:', err);
      alert("Failed to generate PDF. Check browser console for details.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        .text-dark { color: #111827; }
        .bg-footer { background-color: #0F172A; }
      `}</style>

      {/* Editor Controls */}
      <div className="max-w-4xl mx-auto mb-6 bg-white rounded-lg shadow p-6 relative">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Invoice Generator</h1>
            <p className="text-[10px] text-gray-400 font-mono tracking-wider">2602161528</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {libraryError ? (
              <span className="flex items-center gap-1 text-red-500 font-medium bg-red-50 px-2 py-1 rounded">
                <AlertCircle className="w-3 h-3" /> Library Error
              </span>
            ) : isLibraryLoaded ? (
              <span className="flex items-center gap-1 text-green-600 font-medium bg-green-50 px-2 py-1 rounded">
                <CheckCircle2 className="w-3 h-3" /> System Ready
              </span>
            ) : (
              <span className="text-gray-400 animate-pulse">Initializing system...</span>
            )}
          </div>
        </div>
        
        {/* Customer Selector */}
        <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex justify-between items-center mb-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Users className="w-4 h-4" /> Select Recipient
            </label>
            {selectedCustomerId === 1 && (
              <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold uppercase tracking-tight">
                Logo: PAD Thai (Auto)
              </span>
            )}
          </div>
          <select 
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
            className="w-full md:w-1/2 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
          >
            {customers.map(customer => (
              <option key={customer.id} value={customer.id}>{customer.displayName}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="p-4 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-blue-100 transition-colors"
               onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-8 h-8 text-blue-500 mb-2" />
            <p className="text-sm text-blue-700 font-medium">Upload Invoices</p>
            <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
          </div>
          
          <div className="flex flex-col justify-center gap-3 col-span-2 md:col-span-2">
            <div className="flex gap-4">
               <button 
                onClick={addNewItem}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm active:scale-[0.98]"
              >
                <Plus className="w-5 h-5" /> Add Item
              </button>
              <button 
                onClick={handleDownloadPDF}
                disabled={!isLibraryLoaded || isDownloading}
                className={`flex-1 flex items-center justify-center gap-2 text-white px-4 py-3 rounded-lg font-medium transition-colors shadow-sm active:scale-[0.98] ${
                  isLibraryLoaded && !isDownloading ? 'bg-gray-800 hover:bg-gray-900' : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                <Download className="w-5 h-5" />
                {isDownloading ? 'Processing...' : 'Download PDF'}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Line Items Editor</h2>
          {items.map((item, index) => (
            <div key={item.id} className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-gray-50 p-3 rounded border border-gray-200">
              <span className="text-gray-400 font-mono text-xs w-6">{index + 1}.</span>
              <input 
                type="text" 
                value={item.description}
                onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                placeholder="Description"
                className="flex-grow p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input 
                  type="number" 
                  value={item.amount}
                  onChange={(e) => updateItem(item.id, 'amount', e.target.value)}
                  placeholder="0.00"
                  className="w-32 pl-7 p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 p-2"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Invoice Preview Section */}
      <div className="flex justify-center overflow-auto pb-10">
        <div id="invoice-preview" className="bg-white shadow-2xl w-[210mm] h-[297mm] relative text-gray-800 flex flex-col justify-between shrink-0">
          
          <div className="p-12 pb-0">
            <div className="flex justify-between items-start mb-12">
              <div><h1 className="text-5xl font-bold text-dark tracking-tight">Invoice</h1></div>
              <div 
                className="w-48 h-24 flex items-center justify-end cursor-pointer group relative"
                onClick={() => logoInputRef.current?.click()}
              >
                <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                {logoSrc ? (
                  <img 
                    src={logoSrc} 
                    alt="Logo" 
                    crossOrigin="anonymous" 
                    className="max-h-full max-w-full object-contain" 
                  />
                ) : (
                  <div className="border border-dashed border-gray-300 w-full h-full flex items-center justify-center text-gray-400 text-[10px] bg-gray-50 group-hover:bg-gray-100 text-center px-4">
                    Click to manually upload Logo
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between mb-12">
              <div className="flex gap-16">
                <div>
                  <h3 className="text-label text-[10px] uppercase font-bold mb-2">From:</h3>
                  <div className="text-sm leading-relaxed text-dark font-medium">
                    <p className="font-bold text-base mb-1">Chaitawat P</p>
                    <p className="text-gray-500 font-normal">120 Lindrum Road</p>
                    <p className="text-gray-500 font-normal">Frankston VIC 3199</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-label text-[10px] uppercase font-bold mb-2">To:</h3>
                   <div className="text-sm leading-relaxed text-dark font-medium">
                    <p className="font-bold text-base mb-1">{currentCustomer.nameLine1}</p>
                    {currentCustomer.nameLine2 && <p className="font-bold text-base mb-1">{currentCustomer.nameLine2}</p>}
                    <p className="text-gray-500 font-normal">{currentCustomer.addressLine1}</p>
                    <p className="text-gray-500 font-normal">{currentCustomer.addressLine2}</p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                 <h3 className="text-label text-[10px] uppercase font-bold mb-2">Info:</h3>
                 <div className="mb-2"><span className="text-dark font-bold text-xl block">{formatCurrency(totalGross)}</span></div>
                 <div className="text-[11px] text-gray-500">
                    <div className="mb-1 uppercase tracking-wider">Date: {invoiceDate}</div>
                    <div className="uppercase tracking-wider">Ref: #{new Date().getTime().toString().slice(-6)}</div>
                 </div>
              </div>
            </div>

            <div className="mb-10 py-6 border-y border-gray-100 flex gap-2 items-center">
              <span className="text-label text-[10px] uppercase font-bold tracking-widest">Subject:</span>
              <span className="font-bold text-dark text-lg italic">
                {isMeekhun ? "Rent" : "Chargeback from PAD Thai Food"}
              </span>
            </div>

            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="pb-4 text-[10px] font-bold text-label uppercase tracking-widest w-2/5">Description</th>
                  <th className="pb-4 text-[10px] font-bold text-label uppercase tracking-widest text-center">Qty</th>
                  <th className="pb-4 text-[10px] font-bold text-label uppercase tracking-widest text-right">Unit Price</th>
                  <th className="pb-4 text-[10px] font-bold text-label uppercase tracking-widest text-right">GST</th>
                  <th className="pb-4 text-[10px] font-bold text-label uppercase tracking-widest text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item) => {
                  const itemAmount = parseFloat(item.amount.toString()) || 0;
                  const itemGST = isMeekhun ? 0 : itemAmount / 11;
                  return (
                    <tr key={item.id}>
                      <td className="py-5 text-sm font-bold text-dark pr-4">{item.description}</td>
                      <td className="py-5 text-sm text-center text-dark">1</td>
                      <td className="py-5 text-sm text-right text-gray-600">{formatCurrency(itemAmount)}</td>
                      <td className="py-5 text-sm text-right text-gray-400">{formatCurrency(itemGST)}</td>
                      <td className="py-5 text-sm text-right text-dark font-bold">{formatCurrency(itemAmount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="mt-8 border-t-2 border-dark pt-6 flex justify-end">
              <div className="text-right">
                <span className="text-[10px] font-bold text-label uppercase tracking-widest block mb-1">Total Amount Due</span>
                <span className="font-black text-dark text-4xl leading-none">{formatCurrency(totalGross)}</span>
              </div>
            </div>
          </div>

          <div className="bg-footer text-white p-12 mt-auto print:bg-[#0F172A] print:text-white">
            <div className="flex justify-between items-end">
              <div className="space-y-4">
                <h3 className="text-gray-400 text-[10px] uppercase font-bold tracking-[0.2em] mb-4">Bank Details</h3>
                <div className="text-[11px] leading-relaxed">
                  <p className="font-bold text-sm mb-1">Chaitawat Poovaviranon</p>
                  <p className="text-gray-300 font-medium">BSB: 063-607</p>
                  <p className="text-gray-300 font-medium">Account: 1085 5707</p>
                  <p className="text-gray-300 font-medium">ABN: 38 496 177 905</p>
                </div>
              </div>
              <div className="text-gray-500 font-mono text-[9px] print:hidden opacity-50">
                2602161528
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}