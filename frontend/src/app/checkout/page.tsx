'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, MapPin, Truck, Shield, ChevronRight, CheckCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const DELIVERY_OPTIONS = [
  { id: 'standard', label: 'Standard', days: '3-5 days', price: 0 },
  { id: 'express', label: 'Express', days: '1-2 days', price: 29 },
  { id: 'same_day', label: 'Same Day', days: 'Today', price: 59 },
];

interface CheckoutForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  zip: string;
}

export default function CheckoutPage() {
  const [step, setStep] = useState(0);
  const [delivery, setDelivery] = useState('standard');
  const [form, setForm] = useState<CheckoutForm>({ firstName: '', lastName: '', email: '', phone: '', street: '', city: '', zip: '' });
  const deliveryCost = DELIVERY_OPTIONS.find(d => d.id === delivery)?.price || 0;
  const total = 328.20 + deliveryCost;

  if (step === 3) return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-20 h-20 rounded-full bg-green-400/20 flex items-center justify-center mx-auto mb-4">
        <CheckCircle size={40} className="text-green-400" />
      </motion.div>
      <h1 className="text-2xl font-black text-white mb-2">Order Placed!</h1>
      <p className="text-white/50 mb-6">Your order has been confirmed.</p>
      <a href="/" className="btn-primary inline-block px-8">Back to Home</a>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      <h1 className="text-xl font-black text-white mb-6">Checkout</h1>

      {/* Steps */}
      <div className="flex items-center gap-2 mb-6">
        {['Address', 'Delivery', 'Payment'].map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i <= step ? 'bg-[#00d4ff] text-black' : 'bg-white/10 text-white/40'}`}>{i + 1}</div>
            <span className={`text-xs ${i === step ? 'text-[#00d4ff]' : 'text-white/40'} hidden sm:block`}>{s}</span>
            {i < 2 ? <div className={`flex-1 h-0.5 ${i < step ? 'bg-[#00d4ff]' : 'bg-white/10'}`} /> : null}
          </div>
        ))}
      </div>

      {step === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex items-center gap-2 mb-4"><MapPin size={16} className="text-[#00d4ff]" /><h2 className="text-white font-semibold">Delivery Address</h2></div>
          <div className="grid grid-cols-2 gap-3">
            {(['firstName', 'lastName'] as const).map(f => (
              <div key={f} className="glass-card px-3 py-2">
                <label className="text-white/40 text-xs capitalize">{f === 'firstName' ? 'First Name' : 'Last Name'}</label>
                <input value={form[f]} onChange={e => setForm(p => ({...p, [f]: e.target.value}))} className="bg-transparent text-white outline-none w-full text-sm" />
              </div>
            ))}
          </div>
          {(['email', 'phone', 'street', 'city', 'zip'] as const).map(f => (
            <div key={f} className="glass-card px-3 py-2">
              <label className="text-white/40 text-xs capitalize">{f}</label>
              <input value={form[f]} onChange={e => setForm(p => ({...p, [f]: e.target.value}))} className="bg-transparent text-white outline-none w-full text-sm" />
            </div>
          ))}
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setStep(1)} className="btn-primary w-full flex items-center justify-center gap-2">Continue <ChevronRight size={16} /></motion.button>
        </motion.div>
      ) : null}

      {step === 1 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="flex items-center gap-2 mb-4"><Truck size={16} className="text-[#00d4ff]" /><h2 className="text-white font-semibold">Delivery Method</h2></div>
          {DELIVERY_OPTIONS.map(opt => (
            <motion.div key={opt.id} whileTap={{ scale: 0.98 }} onClick={() => setDelivery(opt.id)} className={`glass-card p-4 flex items-center justify-between cursor-pointer border ${delivery === opt.id ? 'border-[#00d4ff]/50 bg-[#00d4ff]/5' : 'border-transparent'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${delivery === opt.id ? 'border-[#00d4ff]' : 'border-white/30'}`}>
                  {delivery === opt.id ? <div className="w-2.5 h-2.5 rounded-full bg-[#00d4ff]" /> : null}
                </div>
                <div>
                  <p className="text-white font-medium text-sm">{opt.label}</p>
                  <p className="text-white/40 text-xs">{opt.days}</p>
                </div>
              </div>
              <span className={`text-sm font-bold ${opt.price === 0 ? 'text-green-400' : 'text-[#00d4ff]'}`}>{opt.price === 0 ? 'Free' : formatCurrency(opt.price)}</span>
            </motion.div>
          ))}
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setStep(2)} className="btn-primary w-full flex items-center justify-center gap-2">Continue <ChevronRight size={16} /></motion.button>
        </motion.div>
      ) : null}

      {step === 2 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex items-center gap-2 mb-4"><CreditCard size={16} className="text-[#00d4ff]" /><h2 className="text-white font-semibold">Payment</h2></div>
          <div className="glass-card p-4 border border-[#00d4ff]/20 space-y-3">
            <div>
              <label className="text-white/40 text-xs">Card Number</label>
              <input placeholder="1234 5678 9012 3456" className="bg-transparent text-white outline-none w-full text-sm mt-1 font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-white/40 text-xs">Expiry</label><input placeholder="MM/YY" className="bg-transparent text-white outline-none w-full text-sm mt-1 font-mono" /></div>
              <div><label className="text-white/40 text-xs">CVV</label><input placeholder="•••" className="bg-transparent text-white outline-none w-full text-sm mt-1 font-mono" /></div>
            </div>
          </div>
          <div className="glass-card p-4 space-y-2">
            <div className="flex justify-between text-white/60 text-sm"><span>Products</span><span>{formatCurrency(328.20)}</span></div>
            <div className="flex justify-between text-white/60 text-sm"><span>Shipping</span><span>{deliveryCost > 0 ? formatCurrency(deliveryCost) : 'Free'}</span></div>
            <div className="border-t border-white/10 pt-2 flex justify-between text-white font-bold text-lg"><span>Total</span><span className="text-[#00d4ff]">{formatCurrency(total)}</span></div>
          </div>
          <div className="flex items-center gap-2 text-white/40 text-xs"><Shield size={12} /><span>Secured by Stripe. Your data is protected.</span></div>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setStep(3)} className="btn-primary w-full flex items-center justify-center gap-2 text-lg">
            Pay {formatCurrency(total)} <CreditCard size={18} />
          </motion.button>
        </motion.div>
      ) : null}
    </div>
  );
}
