import {
  ArrowUpRight,
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  HelpCircle,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  RotateCcw,
  Send,
  Sparkles,
  Tag,
  User,
  Zap
} from 'lucide-react';
import React, { useState } from 'react';
import {
  CONCIERGE_PERSONAS,
  INITIAL_CAPTURED_BOOKINGS,
  type CapturedBookingRecord,
  type ConciergeChatMessage,
  type ConciergePersona
} from '../../shared/demoSaaSSampleData.ts';

interface AiConciergeDemoProps {
  onCtaClick: (serviceTitle: string) => void;
}

export function AiConciergeDemo({ onCtaClick }: AiConciergeDemoProps) {
  const [selectedPersonaId, setSelectedPersonaId] = useState<'dental' | 'auto' | 'packaging'>('dental');
  const [selectedChannel, setSelectedChannel] = useState<'Web Chat' | 'Messenger' | 'Viber'>('Web Chat');

  // Active persona object
  const activePersona: ConciergePersona = CONCIERGE_PERSONAS[selectedPersonaId];

  // Chat messages state initialized with the selected persona's initial greeting
  const [messages, setMessages] = useState<ConciergeChatMessage[]>([
    {
      id: 'msg-init',
      sender: 'assistant',
      text: CONCIERGE_PERSONAS.dental.initialGreeting,
      timestamp: 'Just now'
    }
  ]);

  // Input field state
  const [inputValue, setInputValue] = useState('');

  // Right side captured bookings feed
  const [capturedBookings, setCapturedBookings] = useState<CapturedBookingRecord[]>(INITIAL_CAPTURED_BOOKINGS);

  // Right side view tab: 'leads' | 'knowledge'
  const [rightTab, setRightTab] = useState<'leads' | 'knowledge'>('leads');

  // Feedback banner
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Switch persona handler
  const handleSwitchPersona = (id: 'dental' | 'auto' | 'packaging') => {
    setSelectedPersonaId(id);
    const newPersona = CONCIERGE_PERSONAS[id];
    setMessages([
      {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: newPersona.initialGreeting,
        timestamp: 'Just now'
      }
    ]);
    setFeedbackNotice(`Switched SME Persona to "${newPersona.name}". Knowledge base & prices updated.`);
    setTimeout(() => setFeedbackNotice(null), 3000);
  };

  // Reset sandbox handler
  const handleResetDemo = () => {
    setSelectedPersonaId('dental');
    setSelectedChannel('Web Chat');
    setMessages([
      {
        id: 'msg-init-reset',
        sender: 'assistant',
        text: CONCIERGE_PERSONAS.dental.initialGreeting,
        timestamp: 'Just now'
      }
    ]);
    setCapturedBookings(INITIAL_CAPTURED_BOOKINGS);
    setRightTab('leads');
    setInputValue('');
    setFeedbackNotice('AI Concierge sandbox reset to default state.');
    setTimeout(() => setFeedbackNotice(null), 3000);
  };

  // Simulate AI Response based on keywords and current persona
  const generateSimulatedAiResponse = (userPrompt: string): ConciergeChatMessage => {
    const lower = userPrompt.toLowerCase();
    const timeStr = 'Just now';

    // 1. Pricing inquiry
    if (lower.includes('how much') || lower.includes('price') || lower.includes('rates') || lower.includes('cost') || lower.includes('magkano')) {
      const p1 = activePersona.priceList[0];
      const p2 = activePersona.priceList[1];
      const p3 = activePersona.priceList[2];
      return {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: `Here are our standard official rates for ${activePersona.name}:\n• ${p1.service}: ₱${p1.pricePhp.toLocaleString()} (${p1.note})\n• ${p2.service}: ₱${p2.pricePhp.toLocaleString()} (${p2.note})\n• ${p3.service}: ₱${p3.pricePhp.toLocaleString()} (${p3.note})\n\nWould you like me to reserve an appointment or prepare an itemized quotation for you?`,
        timestamp: timeStr,
        hasAction: 'booking',
        actionData: {
          serviceName: p2.service,
          pricePhp: p2.pricePhp,
          proposedSlot: activePersona.availableSlots[1] || 'Tomorrow 2:00 PM'
        }
      };
    }

    // 2. Schedule or operating hours inquiry
    if (lower.includes('schedule') || lower.includes('saturday') || lower.includes('open') || lower.includes('hours') || lower.includes('time')) {
      return {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: `We are located at ${activePersona.location}.\nOperating Hours: ${activePersona.operatingHours}.\n\nEarliest available slots open for online booking:\n1. ${activePersona.availableSlots[0]}\n2. ${activePersona.availableSlots[1]}\n3. ${activePersona.availableSlots[2]}\n\nTap below to confirm your slot immediately:`,
        timestamp: timeStr,
        hasAction: 'booking',
        actionData: {
          serviceName: activePersona.priceList[1].service,
          pricePhp: activePersona.priceList[1].pricePhp,
          proposedSlot: activePersona.availableSlots[0]
        }
      };
    }

    // 3. Location / Address inquiry
    if (lower.includes('where') || lower.includes('address') || lower.includes('location') || lower.includes('parking')) {
      return {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: `We are conveniently located at: ${activePersona.location}.\nParking: Designated customer parking is available on-site.\nHours: ${activePersona.operatingHours}.\nWould you like us to assist you with booking or directions?`,
        timestamp: timeStr
      };
    }

    // 4. Booking or order confirmation intention
    if (lower.includes('book') || lower.includes('reserve') || lower.includes('order') || lower.includes('appointment')) {
      const targetService = activePersona.priceList[0];
      return {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: `I'd be pleased to arrange that! I have locked in a tentative slot for ${targetService.service} (₱${targetService.pricePhp.toLocaleString()}) on ${activePersona.availableSlots[0]}. Please confirm to finalize your record:`,
        timestamp: timeStr,
        hasAction: 'booking',
        actionData: {
          serviceName: targetService.service,
          pricePhp: targetService.pricePhp,
          proposedSlot: activePersona.availableSlots[0]
        }
      };
    }

    // Default polite assistant reply with context
    return {
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      text: `Thank you for contacting ${activePersona.name}! Our AI Concierge is active on ${selectedChannel}. We can assist with pricing for ${activePersona.priceList.map((p) => p.service).slice(0, 2).join(' or ')}, or reserve a slot for ${activePersona.availableSlots[1]}. How can I best help you?`,
      timestamp: timeStr
    };
  };

  // Send message handler
  const handleSendMessage = (textToSend?: string) => {
    const query = (textToSend || inputValue).trim();
    if (!query) return;

    const userMsg: ConciergeChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: 'Just now'
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInputValue('');

    // Simulate instant AI typing delay
    setTimeout(() => {
      const aiReply = generateSimulatedAiResponse(query);
      setMessages((prev) => [...prev, aiReply]);
    }, 400);
  };

  // Confirm booking action directly inside chat
  const handleConfirmBookingFromChat = (serviceTitle: string, pricePhp: number, slot: string) => {
    const newBooking: CapturedBookingRecord = {
      id: `book-${Date.now()}`,
      personaId: selectedPersonaId,
      clientName: 'Live Chat Visitor (You)',
      contactNumber: '+63 917 500 ' + Math.floor(1000 + Math.random() * 9000),
      serviceTitle,
      totalPhp: pricePhp,
      scheduledTime: slot,
      channel: selectedChannel,
      confirmedAt: 'Just now',
      status: 'Confirmed'
    };

    setCapturedBookings([newBooking, ...capturedBookings]);
    setRightTab('leads');

    // Add confirmation message to chat
    const confirmMsg: ConciergeChatMessage = {
      id: `msg-confirm-${Date.now()}`,
      sender: 'assistant',
      text: `Appointment confirmed! We have recorded your slot for ${serviceTitle} on ${slot}. An SMS confirmation has been simulated to your mobile number. See you at ${activePersona.name}!`,
      timestamp: 'Just now'
    };
    setMessages((prev) => [...prev, confirmMsg]);

    setFeedbackNotice(`Booking confirmed and captured in Business Owner Dashboard!`);
    setTimeout(() => setFeedbackNotice(null), 3500);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* 1. SLIM DEMO TOP BANNER */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-900 px-4 sm:px-6 py-2.5 text-xs text-white">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-teal-400" />
          <span className="font-semibold tracking-wide">
            Interactive Sandbox Demo (Simulated AI — Sample Data)
          </span>
          <span className="hidden sm:inline text-slate-400">
            · Omnichannel SME Customer Support &amp; Booking Lead Gen
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleResetDemo}
            className="inline-flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700 hover:text-white"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset Demo</span>
          </button>
          <button
            type="button"
            onClick={() => onCtaClick('Gitstack AI Concierge')}
            className="inline-flex items-center gap-1.5 rounded bg-[var(--gs-primary)] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
          >
            <span>Get This for Your Business</span>
            <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {feedbackNotice && (
        <div className="bg-teal-50 border-b border-teal-200 px-4 py-2 text-xs font-semibold text-teal-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-teal-600" />
            <span>{feedbackNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackNotice(null)}
            className="text-xs text-teal-700 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. PERSONA SWITCHER BAR */}
      <div className="border-b border-slate-200 bg-slate-50/80 px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900">Switch SME Preset:</span>
            <span className="text-xs text-slate-500 hidden md:inline">
              Simulates custom system prompts, menus &amp; working hours
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'dental', name: 'SmileCare Dental Clinic', icon: '🦷' },
                { id: 'auto', name: 'Apex Auto Service Center', icon: '🔧' },
                { id: 'packaging', name: 'Metro B2B Packaging Supply', icon: '📦' }
              ] as const
            ).map((p) => {
              const active = selectedPersonaId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSwitchPersona(p.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{p.icon}</span>
                  <span>{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. SPLIT WORKSPACE: CUSTOMER CHAT SIMULATOR (LEFT) VS BUSINESS DASHBOARD (RIGHT) */}
      <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANEL: INTERACTIVE CHAT WIDGET */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col h-[650px] shadow-sm">
          {/* Chat Header with Channel Badges */}
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-teal-100 border border-teal-200 flex items-center justify-center text-teal-800">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <div className="font-display text-xs font-bold text-slate-900">
                  {activePersona.name} AI Assistant
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>Online · Responds in ~0.4s</span>
                </div>
              </div>
            </div>

            {/* Omnichannel Selector Badges */}
            <div className="flex items-center gap-1">
              {(['Web Chat', 'Messenger', 'Viber'] as const).map((channel) => (
                <button
                  key={channel}
                  type="button"
                  onClick={() => setSelectedChannel(channel)}
                  className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    selectedChannel === channel
                      ? 'bg-white text-slate-900 border border-slate-300 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {channel}
                </button>
              ))}
            </div>
          </div>

          {/* Try Asking Prompt Chips */}
          <div className="bg-slate-50/70 border-b border-slate-200 p-2.5 px-4 overflow-x-auto">
            <div className="text-[10.5px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-teal-600" />
              <span>Try asking the AI:</span>
            </div>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              {activePersona.suggestedPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(prompt)}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-teal-400 hover:text-teal-800 hover:bg-teal-50 transition-colors shadow-2xs"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/30">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-2xs leading-relaxed whitespace-pre-line ${
                    msg.sender === 'user'
                      ? 'bg-[var(--gs-primary)] text-white rounded-br-sm'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm'
                  }`}
                >
                  {msg.text}
                </div>

                {/* Interactive In-Chat Booking Confirmation Card */}
                {msg.hasAction === 'booking' && msg.actionData && (
                  <div className="mt-2 w-full max-w-[85%] rounded-xl border border-teal-200 bg-teal-50/80 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-bold text-teal-950 uppercase tracking-wide">
                          Recommended Booking / Order Slot
                        </div>
                        <div className="text-xs font-bold text-slate-900 mt-0.5">
                          {msg.actionData.serviceName}
                        </div>
                        <div className="text-[11px] font-mono text-teal-800 mt-0.5 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{msg.actionData.proposedSlot}</span>
                        </div>
                      </div>
                      <div className="font-mono text-sm font-bold text-teal-900 tabular-nums">
                        ₱{msg.actionData.pricePhp.toLocaleString()}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleConfirmBookingFromChat(
                          msg.actionData!.serviceName,
                          msg.actionData!.pricePhp,
                          msg.actionData!.proposedSlot || 'Confirmed Time'
                        )
                      }
                      className="w-full min-h-[34px] rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-800 flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Confirm Booking &amp; Sync to Dashboard</span>
                    </button>
                  </div>
                )}

                <span className="mt-1 font-mono text-[9.5px] text-slate-400 px-1">
                  {msg.timestamp}
                </span>
              </div>
            ))}
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="border-t border-slate-200 bg-white p-3 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={`Ask about rates, slots, or services for ${activePersona.name}...`}
              className="flex-1 min-h-[38px] rounded-lg border border-slate-200 px-3 text-xs text-slate-900 focus:border-teal-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="min-h-[38px] px-3.5 rounded-lg bg-teal-700 text-white font-semibold text-xs hover:bg-teal-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <Send className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </div>

        {/* RIGHT PANEL: BUSINESS OWNER DASHBOARD VIEW */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col h-[650px] shadow-sm">
          {/* Owner View Header */}
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-teal-600" />
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-slate-800">
                Business Owner Back-Office View
              </h3>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setRightTab('leads')}
                className={`rounded px-2.5 py-1 text-xs font-semibold ${
                  rightTab === 'leads'
                    ? 'bg-white text-slate-900 border border-slate-200 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Captured Leads ({capturedBookings.length})
              </button>
              <button
                type="button"
                onClick={() => setRightTab('knowledge')}
                className={`rounded px-2.5 py-1 text-xs font-semibold ${
                  rightTab === 'knowledge'
                    ? 'bg-white text-slate-900 border border-slate-200 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                FAQ &amp; Price Sheet
              </button>
            </div>
          </div>

          {/* TAB A: LIVE CAPTURED BOOKINGS & ORDERS */}
          {rightTab === 'leads' && (
            <div className="p-4 flex-1 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                  <span>Omnichannel Real-Time Inquiries</span>
                  <span className="text-emerald-700 font-semibold">● Auto-CRM Sync Active</span>
                </div>

                {capturedBookings.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2 text-xs hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-slate-500" />
                          <span>{b.clientName}</span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          {b.contactNumber}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="inline-block rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {b.status}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                          {b.channel}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-200/80 pt-2 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{b.serviceTitle}</span>
                      <span className="font-mono font-bold text-slate-900">
                        ₱{b.totalPhp.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span>Slot: {b.scheduledTime}</span>
                      <span>{b.confirmedAt}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Webhook dispatch: Zapier / Google Sheets</span>
                <button
                  type="button"
                  onClick={() => {
                    const randomName = ['Jasmine Santos', 'Mark Villanueva', 'Grace Lim'][
                      Math.floor(Math.random() * 3)
                    ];
                    const randomSlot = activePersona.availableSlots[0];
                    const s = activePersona.priceList[0];
                    const simulated: CapturedBookingRecord = {
                      id: `book-${Date.now()}`,
                      personaId: selectedPersonaId,
                      clientName: randomName,
                      contactNumber: '+63 917 889 ' + Math.floor(1000 + Math.random() * 9000),
                      serviceTitle: s.service,
                      totalPhp: s.pricePhp,
                      scheduledTime: randomSlot,
                      channel: selectedChannel,
                      confirmedAt: 'Just now',
                      status: 'Confirmed'
                    };
                    setCapturedBookings([simulated, ...capturedBookings]);
                    setFeedbackNotice(`Simulated inbound lead from ${randomName} captured!`);
                    setTimeout(() => setFeedbackNotice(null), 3000);
                  }}
                  className="font-semibold text-teal-700 hover:underline"
                >
                  + Simulate Inbound Lead
                </button>
              </div>
            </div>
          )}

          {/* TAB B: LOADED KNOWLEDGE BASE & PRICE SHEET */}
          {rightTab === 'knowledge' && (
            <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
              <div>
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-teal-700" />
                  <span>Business Profile &amp; Location</span>
                </h4>
                <div className="mt-1 text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
                  <div>
                    <strong className="text-slate-800">Address:</strong> {activePersona.location}
                  </div>
                  <div>
                    <strong className="text-slate-800">Hours:</strong> {activePersona.operatingHours}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5 mb-2">
                  <Tag className="h-3.5 w-3.5 text-teal-700" />
                  <span>Approved Price Sheet &amp; Services</span>
                </h4>
                <div className="space-y-2">
                  {activePersona.priceList.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 flex items-start justify-between gap-2"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">{item.service}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{item.note}</div>
                      </div>
                      <div className="font-mono font-bold text-slate-900 shrink-0">
                        ₱{item.pricePhp.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
