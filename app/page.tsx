/** * Invoice Generator
 * Version: 2608111700
 */
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Plus, Upload, Users, Printer, Edit3, Landmark, Search, Send, Rows, X } from 'lucide-react';
import { toJpeg } from 'html-to-image';
import jsPDF from 'jspdf';

// --- Interfaces & Types ---

interface Customer {
  id: number;
  displayName: string;
  nameLine1: string;
  nameLine2: string;
  addressLine1: string;
  addressLine2: string;
  defaultSubject: string;
}

interface InvoiceItem {
  id: number;
  description: string;
  date: string;
  reference: string;
  amount: number | string;
}

interface SquareLocation {
  id: string;
  name: string;
}

interface QuestOrderMatch {
  orderId: string;
  date: string;
  description: string;
  amount: number;
}

// --- Main Application ---

export default function InvoiceGenerator() {
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
      addressLine2: "Frankston VIC 3199",
      defaultSubject: "Chargeback from PAD Thai Food"
    },
    {
      id: 2,
      displayName: "MEEKHUN PTY LTD",
      nameLine1: "MEEKHUN PTY LTD",
      nameLine2: "",
      addressLine1: "77 Harrison Dr",
      addressLine2: "Noble Park VIC 3174",
      defaultSubject: "Rent"
    },
    {
      id: 3,
      displayName: "Custom Template",
      nameLine1: "Recipient Name",
      nameLine2: "",
      addressLine1: "Address Line 1",
      addressLine2: "City State Postcode",
      defaultSubject: "Custom Invoice Subject"
    }
  ];

  const QUEST_EMAIL = 'fom.fob@questapartments.com.au';

  // State
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: 1, description: 'Chargeback', date: '', reference: '', amount: 143.48 }
  ]);
  const [invoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceRef] = useState(generateReference());
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(customers[0].id);

  // Subject line — editable for every template, defaults per template on switch
  const [subject, setSubject] = useState(customers[0].defaultSubject);

  // Consolidate toggle — rendering-only, never mutates the underlying items
  const [consolidate, setConsolidate] = useState(false);

  // Custom Template Fields
  const [customRecipient, setCustomRecipient] = useState<Customer>(customers[2]);

  // Bank Details State
  const [bankDetails, setBankDetails] = useState({
    name: "Chaitawat Poovaviranon",
    bsb: "063-607",
    account: "1085 5707",
    abn: "38 496 177 905"
  });

  // Square lookup state
  const [squareLocations, setSquareLocations] = useState<SquareLocation[]>([]);
  const [squareLocationsLoading, setSquareLocationsLoading] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [squareStartDate, setSquareStartDate] = useState('');
  const [squareEndDate, setSquareEndDate] = useState('');
  const [squareFetching, setSquareFetching] = useState(false);
  const [squareError, setSquareError] = useState<string | null>(null);
  const [squareInfo, setSquareInfo] = useState<string | null>(null);

  // Export / send state
  const [exporting, setExporting] = useState(false);
  const [sendTo, setSendTo] = useState(QUEST_EMAIL);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const invoiceRef2 = useRef<HTMLDivElement>(null); // #invoice-preview node ref for export

  // AUTO LOGO LOGIC (Disabled for Custom)
  useEffect(() => {
    if (selectedCustomerId === 1) {
      setLogoSrc('/pad-logo.png');
    } else if (selectedCustomerId === 2) {
      setLogoSrc(null);
    }
    // If ID is 3 (Custom), we don't force logoSrc, allowing manual upload
  }, [selectedCustomerId]);

  // Reset subject + send-to defaults whenever the template changes
  useEffect(() => {
    const customer = customers.find(c => c.id === selectedCustomerId);
    if (customer) setSubject(customer.defaultSubject);
    setSendTo(selectedCustomerId === 1 ? QUEST_EMAIL : '');
    setSquareError(null);
    setSquareInfo(null);
  }, [selectedCustomerId]);

  // Fetch Square locations once, lazily, when the Quest template + Square section is first shown
  useEffect(() => {
    if (selectedCustomerId !== 1 || squareLocations.length > 0 || squareLocationsLoading) return;
    setSquareLocationsLoading(true);
    fetch('/api/square/locations')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Failed to load locations (${res.status})`);
        return data;
      })
      .then((data) => {
        setSquareLocations(data.locations || []);
        const pad = (data.locations || []).find((l: SquareLocation) => l.id === 'LKCRCTTXCQP39');
        if (pad) setSelectedLocationId(pad.id);
        else if (data.locations?.length) setSelectedLocationId(data.locations[0].id);
      })
      .catch((err) => setSquareError(err.message))
      .finally(() => setSquareLocationsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomerId]);

  // Derived State
  const currentCustomer = selectedCustomerId === 3 ? customRecipient : (customers.find(c => c.id === selectedCustomerId) || customers[0]);
  const isMeekhun = selectedCustomerId === 2;
  const isCustom = selectedCustomerId === 3;
  const isQuest = selectedCustomerId === 1;

  const formatCurrency = (val: number | string) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(isNaN(num) ? 0 : num);
  };

  const totalGross = items.reduce((acc, item) => acc + (parseFloat(item.amount.toString()) || 0), 0);

  // Rows actually rendered in the preview table. Consolidating is purely a
  // render-time transform — `items` (the source of truth) is never touched,
  // so toggling back and forth is non-destructive.
  const renderRows: InvoiceItem[] = consolidate
    ? [{ id: -1, description: 'Chargeback', date: '', reference: '', amount: totalGross }]
    : items;

  const addNewItem = () => {
    const newItem: InvoiceItem = {
      id: Date.now(),
      description: isCustom ? 'Item Description' : (isMeekhun ? 'Rent' : 'New Chargeback Item'),
      date: '',
      reference: '',
      amount: 0
    };
    setItems([...items, newItem]);
  };

  const removeItem = (id: number) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: number, field: keyof InvoiceItem, value: string | number) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        const newItems: InvoiceItem[] = files.map((file, index) => ({
          id: Date.now() + index,
          description: `File: ${file.name}`,
          date: new Date().toISOString().split('T')[0],
          reference: '',
          amount: 0
        }));
        setItems([...items, ...newItems]);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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

  // --- Square lookup ---

  const fetchFromSquare = async () => {
    setSquareError(null);
    setSquareInfo(null);
    if (!selectedLocationId || !squareStartDate || !squareEndDate) {
      setSquareError('Pick a location and a start/end date first.');
      return;
    }
    setSquareFetching(true);
    try {
      const res = await fetch('/api/square/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: selectedLocationId,
          startDate: squareStartDate,
          endDate: squareEndDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Square lookup failed (${res.status})`);

      const matches: QuestOrderMatch[] = data.matches || [];
      if (matches.length === 0) {
        setSquareInfo(`No Quest-tagged orders found in this range (scanned ${data.ordersScanned ?? 0} orders).`);
        return;
      }

      const newItems: InvoiceItem[] = matches.map((m, idx) => ({
        id: Date.now() + idx,
        description: m.description,
        date: m.date,
        reference: m.orderId,
        amount: m.amount,
      }));
      // Review step: this replaces the editor rows with the matches, but every
      // row stays fully editable/deletable below before the invoice is generated.
      setItems(newItems);
      setSquareInfo(`Found ${matches.length} Quest-tagged order(s) — review the line items below before generating the invoice.`);
    } catch (err) {
      setSquareError(err instanceof Error ? err.message : 'Unknown error fetching from Square');
    } finally {
      setSquareFetching(false);
    }
  };

  // --- PDF export (client-side, no window.print) ---

  const generatePdfBlob = async (): Promise<Blob> => {
    const node = invoiceRef2.current;
    if (!node) throw new Error('Invoice preview not found');

    // JPEG (not PNG) keeps the file well under serverless body-size limits —
    // a 1.5x PNG render of this page came out ~6MB, base64-inflated to ~8MB,
    // over Vercel's ~4.5MB function payload limit. High-quality JPEG of the
    // same render is well under 1MB with no visible quality loss for a
    // text/table invoice.
    const dataUrl = await toJpeg(node, {
      pixelRatio: 1.5,
      quality: 0.92,
      backgroundColor: '#ffffff',
      filter: (el) => {
        if (el instanceof HTMLElement && el.classList?.contains('pdf-hide')) return false;
        return true;
      },
    });

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    pdf.addImage(dataUrl, 'JPEG', 0, 0, 210, 297);
    return pdf.output('blob');
  };

  const invoiceFilename = () => {
    const safeSubject = subject.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
    return `Invoice_${safeSubject || invoiceRef}_${invoiceDate}.pdf`;
  };

  const handleDownloadPdf = async () => {
    setExporting(true);
    try {
      const blob = await generatePdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = invoiceFilename();
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`PDF export failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setExporting(false);
    }
  };

  // --- Send to Kayla (or whoever is in the "Send to" field) ---

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] || '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const handleConfirmSend = async () => {
    setSending(true);
    setSendError(null);
    setSendSuccess(false);
    try {
      const blob = await generatePdfBlob();
      const pdfBase64 = await blobToBase64(blob);
      const res = await fetch('/api/square/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: sendTo,
          subject,
          pdfBase64,
          filename: invoiceFilename(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Send failed (${res.status})`);
      setSendSuccess(true);
      setShowSendConfirm(false);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Unknown error sending invoice');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans">
      <style>{`
        .text-dark { color: #111827; }
        .text-label { color: #9CA3AF; }
        .bg-footer { background-color: #0F172A; }
      `}</style>

      {/* Editor Controls */}
      <div className="max-w-4xl mx-auto mb-6 bg-white rounded-lg shadow p-6 relative no-print">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-2xl font-bold text-gray-800">Invoice Generator</h1>
          <span className="text-[10px] text-gray-400 font-mono mt-2 tracking-wider uppercase">2608111700</span>
        </div>

        {/* Template Selector */}
        <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex justify-between items-center mb-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Users className="w-4 h-4" />
              Select Template
            </label>
            {isCustom && <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold uppercase">Custom Mode</span>}
          </div>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
            className="w-full md:w-1/2 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm mb-4"
          >
            {customers.map(customer => (
              <option key={customer.id} value={customer.id}>{customer.displayName}</option>
            ))}
          </select>

          {/* Subject line — editable for every template */}
          <div className="space-y-2 mb-2">
            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><Edit3 className="w-3 h-3"/> Subject Line</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full md:w-1/2 p-2 border rounded text-sm outline-none focus:border-blue-400" placeholder="Invoice Subject" />
          </div>

          {/* Custom Information Inputs */}
          {isCustom && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 p-4 bg-white border rounded-lg border-purple-200 animate-in fade-in">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Recipient Name (Line 1)</label>
                <input value={customRecipient.nameLine1} onChange={(e) => setCustomRecipient({...customRecipient, nameLine1: e.target.value})} className="w-full p-2 border rounded text-sm outline-none focus:border-purple-400" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Recipient Sub-name (Line 2)</label>
                <input value={customRecipient.nameLine2} onChange={(e) => setCustomRecipient({...customRecipient, nameLine2: e.target.value})} className="w-full p-2 border rounded text-sm outline-none focus:border-purple-400" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Address Line 1</label>
                <input value={customRecipient.addressLine1} onChange={(e) => setCustomRecipient({...customRecipient, addressLine1: e.target.value})} className="w-full p-2 border rounded text-sm outline-none focus:border-purple-400" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Address Line 2 (City State Code)</label>
                <input value={customRecipient.addressLine2} onChange={(e) => setCustomRecipient({...customRecipient, addressLine2: e.target.value})} className="w-full p-2 border rounded text-sm outline-none focus:border-purple-400" />
              </div>

              {/* Bank Details Customization */}
              <div className="md:col-span-2 pt-4 border-t border-gray-100 mt-2">
                 <label className="text-xs font-bold text-purple-600 uppercase flex items-center gap-1 mb-3"><Landmark className="w-3 h-3"/> Custom Bank Details</label>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Bank Account Name</label>
                      <input value={bankDetails.name} onChange={(e) => setBankDetails({...bankDetails, name: e.target.value})} className="w-full p-2 border rounded text-sm outline-none focus:border-purple-400" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">BSB</label>
                      <input value={bankDetails.bsb} onChange={(e) => setBankDetails({...bankDetails, bsb: e.target.value})} className="w-full p-2 border rounded text-sm outline-none focus:border-purple-400" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Account Number</label>
                      <input value={bankDetails.account} onChange={(e) => setBankDetails({...bankDetails, account: e.target.value})} className="w-full p-2 border rounded text-sm outline-none focus:border-purple-400" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">ABN</label>
                      <input value={bankDetails.abn} onChange={(e) => setBankDetails({...bankDetails, abn: e.target.value})} className="w-full p-2 border rounded text-sm outline-none focus:border-purple-400" />
                    </div>
                 </div>
              </div>
            </div>
          )}
        </div>

        {/* Square Lookup — Quest chargeback workflow */}
        {isQuest && (
          <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
            <label className="flex items-center gap-2 text-sm font-semibold text-blue-900 mb-3">
              <Search className="w-4 h-4" /> Fetch Quest Chargebacks from Square
            </label>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Location</label>
                <select
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value)}
                  className="w-full p-2 border rounded text-sm outline-none focus:border-blue-400 bg-white"
                  disabled={squareLocationsLoading}
                >
                  {squareLocationsLoading && <option>Loading locations…</option>}
                  {!squareLocationsLoading && squareLocations.length === 0 && <option>No locations found</option>}
                  {squareLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Start Date</label>
                <input type="date" value={squareStartDate} onChange={(e) => setSquareStartDate(e.target.value)} className="w-full p-2 border rounded text-sm outline-none focus:border-blue-400" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">End Date</label>
                <input type="date" value={squareEndDate} onChange={(e) => setSquareEndDate(e.target.value)} className="w-full p-2 border rounded text-sm outline-none focus:border-blue-400" />
              </div>
              <button
                onClick={fetchFromSquare}
                disabled={squareFetching}
                className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
              >
                <Search className="w-4 h-4" /> {squareFetching ? 'Fetching…' : 'Fetch from Square'}
              </button>
            </div>
            {squareError && <p className="text-xs text-red-600 mt-2 font-medium">{squareError}</p>}
            {squareInfo && <p className="text-xs text-blue-700 mt-2 font-medium">{squareInfo}</p>}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="p-4 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-blue-100 transition-colors"
               onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-8 h-8 text-blue-500 mb-2" />
            <p className="text-sm text-blue-700 font-medium">Upload Files</p>
            <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
          </div>

          <div className="flex flex-col justify-center gap-3 col-span-2 md:col-span-2">
            <div className="flex gap-4 flex-wrap">
               <button onClick={addNewItem} className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium">
                <Plus className="w-5 h-5" /> Add Item
              </button>
              <button onClick={handleDownloadPdf} disabled={exporting} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg disabled:opacity-50">
                <Printer className="w-5 h-5" /> {exporting ? 'Generating…' : 'Download PDF'}
              </button>
            </div>
          </div>
        </div>

        {/* Consolidate toggle */}
        <div className="mb-6 flex items-center gap-2">
          <input
            type="checkbox"
            id="consolidate-toggle"
            checked={consolidate}
            onChange={(e) => setConsolidate(e.target.checked)}
            className="w-4 h-4 accent-blue-600"
          />
          <label htmlFor="consolidate-toggle" className="text-sm font-medium text-gray-700 flex items-center gap-1 cursor-pointer">
            <Rows className="w-4 h-4" /> Consolidate to one line on the invoice (line items below are kept for your records either way)
          </label>
        </div>

        <div className="space-y-3">
          <h2 className="font-semibold text-gray-700">Line Items Editor</h2>
          {items.map((item, index) => (
            <div key={item.id} className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-gray-50 p-3 rounded border border-gray-200">
              <span className="text-gray-400 font-mono text-sm w-6">{index + 1}.</span>
              <input type="text" value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)} placeholder="Description" className="flex-grow p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
               <input type="date" value={item.date} onChange={(e) => updateItem(item.id, 'date', e.target.value)} className="w-36 p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input type="number" value={item.amount} onChange={(e) => updateItem(item.id, 'amount', e.target.value)} placeholder="0.00" className="w-32 pl-7 p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <button onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-700 p-2"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>

        {/* Send to recipient */}
        <div className="mt-6 pt-6 border-t border-gray-100">
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><Send className="w-4 h-4" /> Send Invoice</h2>
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
            <input
              type="email"
              value={sendTo}
              onChange={(e) => setSendTo(e.target.value)}
              placeholder="recipient@example.com"
              className="flex-grow p-2 border rounded text-sm outline-none focus:border-blue-400 w-full md:w-auto"
            />
            <button
              onClick={() => { setSendError(null); setSendSuccess(false); setShowSendConfirm(true); }}
              disabled={!sendTo || sending}
              className="flex items-center justify-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 transition-colors font-medium disabled:opacity-50"
            >
              <Send className="w-4 h-4" /> Send Invoice
            </button>
          </div>
          {sendSuccess && <p className="text-xs text-green-600 mt-2 font-medium">Invoice sent to {sendTo}.</p>}
          {sendError && <p className="text-xs text-red-600 mt-2 font-medium">{sendError}</p>}
        </div>
      </div>

      {/* Send confirmation modal — explicit click required, no auto-fire */}
      {showSendConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print p-4">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-bold text-gray-800 text-lg">Confirm Send</h3>
              <button onClick={() => setShowSendConfirm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Send this invoice to <span className="font-semibold text-gray-900">{sendTo}</span>?
            </p>
            {sendError && <p className="text-xs text-red-600 mb-4 font-medium">{sendError}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowSendConfirm(false)} disabled={sending} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50">Cancel</button>
              <button onClick={handleConfirmSend} disabled={sending} className="px-4 py-2 rounded-lg bg-slate-800 text-white font-medium hover:bg-slate-900 disabled:opacity-50">{sending ? 'Sending…' : 'Send'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Template (Preview) */}
      <div className="flex justify-center overflow-auto pb-10">
        <div id="invoice-preview" ref={invoiceRef2} className="bg-white shadow-2xl w-[210mm] h-[297mm] relative text-gray-800 flex flex-col justify-between shrink-0">
          <div className="p-12 pb-0">
            <div className="flex justify-between items-start mb-12">
              <div><h1 className="text-5xl font-bold text-dark tracking-tight">Invoice</h1></div>
              <div className="w-48 h-24 flex items-center justify-end cursor-pointer group relative" onClick={() => logoInputRef.current?.click()}>
                <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload}/>
                {logoSrc ? (
                  <img src={logoSrc} alt="Logo" className="max-h-full max-w-full object-contain" />
                ) : (
                  <div className="pdf-hide no-print border border-dashed border-gray-300 w-full h-full flex items-center justify-center text-gray-400 text-xs bg-gray-50 group-hover:bg-gray-100 text-center px-4">
                    Click to add Logo
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between mb-12">
              <div className="flex gap-16">
                <div>
                  <h3 className="text-label text-xs uppercase font-medium mb-1">From:</h3>
                  <div className="text-sm leading-relaxed text-dark font-medium">
                    <p className="font-bold text-base mb-1">Chaitawat P</p>
                    <p className="text-gray-500 font-normal">120 Lindrum Road</p>
                    <p className="text-gray-500 font-normal">Frankston VIC 3199</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-label text-xs uppercase font-medium mb-1">To:</h3>
                   <div className="text-sm leading-relaxed text-dark font-medium">
                    <p className="font-bold text-base mb-1">{currentCustomer.nameLine1}</p>
                    {currentCustomer.nameLine2 && <p className="font-bold text-base mb-1">{currentCustomer.nameLine2}</p>}
                    <p className="text-gray-500 font-normal">{currentCustomer.addressLine1}</p>
                    <p className="text-gray-500 font-normal">{currentCustomer.addressLine2}</p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                 <h3 className="text-label text-xs uppercase font-medium mb-1">Info:</h3>
                 <div className="mb-2"><span className="text-dark font-bold text-xl block">Amount: {formatCurrency(totalGross)}</span></div>
                 <div className="text-sm text-gray-500">
                    <div className="mb-1">Date: {invoiceDate}</div>
                    <div>Reference: {invoiceRef}</div>
                 </div>
              </div>
            </div>

            <div className="mb-10 flex gap-2 items-center">
              <span className="text-label text-sm uppercase">Subject:</span>
              <span className="font-bold text-dark text-lg">
                {subject}
              </span>
            </div>

            <div className="mb-8">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="pb-4 text-xs font-normal text-label uppercase w-2/5">Description</th>
                    <th className="pb-4 text-xs font-normal text-label uppercase text-center">Qty</th>
                    <th className="pb-4 text-xs font-normal text-label uppercase text-right">Price</th>
                    <th className="pb-4 text-xs font-normal text-label uppercase text-right">GST</th>
                    <th className="pb-4 text-xs font-normal text-label uppercase text-right">Net</th>
                    <th className="pb-4 text-xs font-normal text-label uppercase text-right">Gross</th>
                  </tr>
                </thead>
                <tbody>
                  {renderRows.map((item) => {
                    const itemAmount = parseFloat(item.amount.toString()) || 0;
                    const itemGST = isMeekhun ? 0 : itemAmount / 11;
                    const itemNet = itemAmount - itemGST;
                    return (
                      <tr key={item.id}>
                        <td className="py-4 text-sm font-bold text-dark pr-4 border-b border-gray-100">{item.description} {item.date && <div className="font-normal text-xs text-gray-400 mt-1">{item.date}</div>}</td>
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

            <div className="mt-8 border-t-2 border-dark pt-4 border-b-2 pb-4 mb-8">
              <div className="flex justify-between items-center">
                <span className="font-bold text-dark text-lg">Total Gross Amount</span>
                <span className="font-bold text-dark text-lg">{formatCurrency(totalGross)}</span>
              </div>
            </div>
          </div>

          <div className="bg-footer text-white p-12 mt-auto text-xs">
            <div className="flex justify-between items-end">
              <div className="space-y-4">
                <h3 className="text-gray-400 uppercase mb-4 tracking-wider">Bank Details</h3>
                <div className="leading-relaxed">
                  <p className="font-bold text-sm mb-1">{bankDetails.name}</p>
                  <p className="text-gray-300">BSB: {bankDetails.bsb}</p>
                  <p className="text-gray-300">Account: {bankDetails.account}</p>
                  <p className="text-gray-300">ABN: {bankDetails.abn}</p>
                </div>
              </div>
              <div className="pdf-hide no-print text-gray-500 font-mono text-[9px] uppercase">VER: 2608111700</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
