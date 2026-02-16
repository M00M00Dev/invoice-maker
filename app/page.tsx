/** * Invoice Generator
 * Version: 2602161536
 */
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Plus, Upload, Download, Users, Printer } from 'lucide-react';

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
  // Load html2pdf library dynamically
  const [isLibraryLoaded, setIsLibraryLoaded] = useState(false);

  useEffect(() => {
    if (document.getElementById('html2pdf-lib')) {
      setIsLibraryLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'html2pdf-lib';
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => setIsLibraryLoaded(true);
    document.body.appendChild(script);

    return () => {
      // Clean up if necessary
    };
  }, []);

  // Helper to generate reference: yymmddhhmm
  const generateReference = () => {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${yy}${mm}${dd}${hh}${min}`;
  };

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
  const [invoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceRef, setInvoiceRef] = useState(generateReference());
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(customers[0].id);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

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

  // Format currency
  const formatCurrency = (val: number | string) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(isNaN(num) ? 0 : num);
  };

  // Calculations
  const totalGross = items.reduce((acc, item) => acc + (parseFloat(item.amount.toString()) || 0), 0);
  
  // Add new manual item
  const addNewItem = () => {
    const newItem: InvoiceItem = {
      id: Date.now(),
      description: isMeekhun ? 'Rent' : 'New Chargeback Item',
      date: '',
      reference: '',
      amount: 0
    };
    setItems([...items, newItem]);
  };

  // Remove item
  const removeItem = (id: number) => {
    setItems(items.filter(item => item.id !== id));
  };

  // Update item field
  const updateItem = (id: number, field: keyof InvoiceItem, value: string | number) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  // Handle Invoice File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        const newItems: InvoiceItem[] = files.map((file, index) => ({
          id: Date.now() + index,
          description: `File: ${file.name} (Chargeback)`,
          date: new Date().toISOString().split('T')[0],
          reference: '',
          amount: 0 
        }));
        setItems([...items, ...newItems]);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle Logo Upload (Manual Override)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result;
        if (typeof result === 'string') {
          setLogoSrc(result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle PDF Download
  const handleDownloadPDF = () => {
    const html2pdf = (window as any).html2pdf;
    if (!html2pdf) return;
    
    setIsDownloading(true);
    const element = document.getElementById('invoice-preview');
    const opt = {
      margin: 0,
      filename: `Invoice_${invoiceRef}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf()
      .set(opt)
      .from(element)
      .save()
      .then(() => {
        setIsDownloading(false);
      })
      .catch((err: any) => {
        console.error('PDF Generation Error:', err);
        setIsDownloading(false);
      });
  };

  // Handle Browser Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        /* Template Colors */
        .text-dark { color: #111827; }
        .text-label { color: #9CA3AF; } 
        .bg-footer { background-color: #0F172A; }

        @media print {
          /* Hide all UI elements except the invoice area */
          .no-print {
            display: none !important;
          }
          body {
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .min-h-screen {
            background-color: white !important;
            padding: 0 !important;
          }
          #invoice-preview {
            box-shadow: none !important;
            margin: 0 !important;
            width: 100% !important;
            border: none !important;
          }
          /* Ensure colors are printed */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Editor Controls */}
      <div className="max-w-4xl mx-auto mb-6 bg-white rounded-lg shadow p-6 relative no-print">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-2xl font-bold text-gray-800">Invoice Generator</h1>
          <span className="text-[10px] text-gray-400 font-mono mt-2 tracking-wider uppercase">2602161536</span>
        </div>
        
        {/* Customer Selector */}
        <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex justify-between items-center mb-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Users className="w-4 h-4" />
              Select Customer (To:)
            </label>
            {selectedCustomerId === 1 && (
              <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold uppercase tracking-tight">
                Auto Logo Active
              </span>
            )}
          </div>
          <select 
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
            className="w-full md:w-1/2 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
          >
            {customers.map(customer => (
              <option key={customer.id} value={customer.id}>
                {customer.displayName}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* File Upload */}
          <div className="p-4 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-blue-100 transition-colors"
               onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-8 h-8 text-blue-500 mb-2" />
            <p className="text-sm text-blue-700 font-medium">Upload Invoices</p>
            <input 
              type="file" 
              multiple 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileUpload}
            />
          </div>
          
          {/* Actions */}
          <div className="flex flex-col justify-center gap-3 col-span-2 md:col-span-2">
            <div className="flex gap-4">
               <button 
                onClick={addNewItem}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                <Plus className="w-5 h-5" />
                Add Item
              </button>
              <div className="flex flex-1 gap-2">
                <button 
                  onClick={handleDownloadPDF}
                  disabled={!isLibraryLoaded || isDownloading}
                  className={`flex-1 flex items-center justify-center gap-2 text-white px-3 py-3 rounded-lg font-medium transition-colors ${
                    isLibraryLoaded && !isDownloading 
                      ? 'bg-gray-800 hover:bg-gray-900' 
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  PDF
                </button>
                <button 
                  onClick={handlePrint}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-3 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-semibold text-gray-700">Line Items Editor</h2>
          {items.map((item, index) => (
            <div key={item.id} className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-gray-50 p-3 rounded border border-gray-200">
              <span className="text-gray-400 font-mono text-sm w-6">{index + 1}.</span>
              <input 
                type="text" 
                value={item.description}
                onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                placeholder="Description"
                className="flex-grow p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
               <input 
                type="date" 
                value={item.date}
                onChange={(e) => updateItem(item.id, 'date', e.target.value)}
                className="w-36 p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
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
              <button 
                onClick={() => removeItem(item.id)}
                className="text-red-500 hover:text-red-700 p-2"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Actual Invoice Template (Preview Area) */}
      <div className="flex justify-center overflow-auto pb-10">
        <div id="invoice-preview" className="bg-white shadow-2xl w-[210mm] h-[297mm] relative text-gray-800 flex flex-col justify-between shrink-0">
          
          <div className="p-12 pb-0">
            {/* Header Row: Title Left, Logo Right */}
            <div className="flex justify-between items-start mb-12">
              <div>
                <h1 className="text-5xl font-bold text-dark tracking-tight">Invoice</h1>
              </div>
              
              {/* Logo Area */}
              <div 
                className="w-48 h-24 flex items-center justify-end cursor-pointer group relative"
                onClick={() => logoInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={logoInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleLogoUpload}
                />
                {logoSrc ? (
                  <img src={logoSrc} alt="Company Logo" className="max-h-full max-w-full object-contain" />
                ) : (
                  <div className="border border-dashed border-gray-300 w-full h-full flex items-center justify-center text-gray-400 text-xs bg-gray-50 group-hover:bg-gray-100 text-center px-4 no-print">
                    Click to add Logo
                  </div>
                )}
              </div>
            </div>

            {/* Top Info Grid */}
            <div className="flex justify-between mb-12">
              
              {/* Left Column: Addresses */}
              <div className="flex gap-16">
                {/* From */}
                <div>
                  <h3 className="text-label text-xs uppercase font-medium mb-1">From:</h3>
                  <div className="text-sm leading-relaxed text-dark font-medium">
                    <p className="font-bold text-base mb-1">Chaitawat P</p>
                    <p className="text-gray-500 font-normal">120 Lindrum Road</p>
                    <p className="text-gray-500 font-normal">Frankston VIC 3199</p>
                  </div>
                </div>

                {/* To */}
                <div>
                  <h3 className="text-label text-xs uppercase font-medium mb-1">To:</h3>
                   <div className="text-sm leading-relaxed text-dark font-medium">
                    <p className="font-bold text-base mb-1">{currentCustomer.nameLine1}</p>
                    {currentCustomer.nameLine2 && (
                       <p className="font-bold text-base mb-1">{currentCustomer.nameLine2}</p>
                    )}
                    <p className="text-gray-500 font-normal">{currentCustomer.addressLine1}</p>
                    <p className="text-gray-500 font-normal">{currentCustomer.addressLine2}</p>
                  </div>
                </div>
              </div>

              {/* Right Column: Info */}
              <div className="text-right">
                 <h3 className="text-label text-xs uppercase font-medium mb-1">Info:</h3>
                 <div className="mb-2">
                   <span className="text-dark font-bold text-xl block">Amount: {formatCurrency(totalGross)}</span>
                 </div>
                 <div className="text-sm text-gray-500">
                    <div className="mb-1">Date: {invoiceDate}</div>
                    <div>Reference: {invoiceRef}</div>
                 </div>
              </div>
            </div>

            {/* Subject Line (Dynamic based on Customer) */}
            <div className="mb-10 flex gap-2 items-center">
              <span className="text-label text-sm uppercase">Subject:</span>
              <span className="font-bold text-dark text-lg">
                {isMeekhun ? "Rent" : "Chargeback from PAD Thai Food"}
              </span>
            </div>

            {/* Table */}
            <div className="mb-8">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="pb-4 text-xs font-normal text-label uppercase w-2/5">Item Description</th>
                    <th className="pb-4 text-xs font-normal text-label uppercase text-center">Quantity</th>
                    <th className="pb-4 text-xs font-normal text-label uppercase text-right">Unit Price</th>
                    <th className="pb-4 text-xs font-normal text-label uppercase text-right">Unit GST</th>
                    <th className="pb-4 text-xs font-normal text-label uppercase text-right">Total Net</th>
                    <th className="pb-4 text-xs font-normal text-label uppercase text-right">Total Gross</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const itemAmount = parseFloat(item.amount.toString()) || 0;
                    
                    // GST Calculation Per Item (Conditional)
                    const itemGST = isMeekhun ? 0 : itemAmount / 11;
                    const itemNet = itemAmount - itemGST;
                    
                    return (
                      <tr key={item.id}>
                        <td className="py-4 text-sm font-bold text-dark pr-4 border-b border-gray-100">
                          {item.description}
                          {(item.date || item.reference) && (
                            <div className="font-normal text-xs text-gray-400 mt-1">
                              {item.date && `${item.date}`}
                            </div>
                          )}
                        </td>
                        <td className="py-4 text-sm text-center text-dark border-b border-gray-100">1</td>
                        <td className="py-4 text-sm text-right text-dark font-medium border-b border-gray-100">{formatCurrency(itemAmount)}</td>
                        <td className="py-4 text-sm text-right text-dark font-medium border-b border-gray-100">{formatCurrency(itemGST)}</td>
                        <td className="py-4 text-sm text-right text-dark font-medium border-b border-gray-100">{formatCurrency(itemNet)}</td>
                        <td className="py-4 text-sm text-right text-dark font-bold border-b border-gray-100">{formatCurrency(itemAmount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals Section (Bottom of Page Content) */}
            <div className="mt-8 border-t-2 border-dark pt-4 border-b-2 pb-4 mb-8">
              <div className="flex justify-between items-center">
                <span className="font-bold text-dark text-lg">Total Gross Amount</span>
                <span className="font-bold text-dark text-lg">{formatCurrency(totalGross)}</span>
              </div>
            </div>
          </div>

          {/* Footer - Dark Navy Block */}
          <div className="bg-footer text-white p-12 mt-auto print:bg-[#0F172A] print:text-white text-xs">
            <div className="flex justify-between items-end">
              <div className="space-y-4">
                <h3 className="text-gray-400 uppercase mb-4 tracking-wider">Bank Details</h3>
                <div className="leading-relaxed">
                  <p className="font-bold text-sm mb-1">Chaitawat Poovaviranon</p>
                  <p className="text-gray-300">BSB: 063-607</p>
                  <p className="text-gray-300">Account: 1085 5707</p>
                  <p className="text-gray-300">ABN: 38 496 177 905</p>
                </div>
              </div>
              <div className="text-gray-500 font-mono text-[9px] print:hidden">
                VER: 2602161536
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}