(() => {
  "use strict";

  const STORAGE_KEY = "calendra_appointments_v3";
  const THEME_KEY = "calendra_theme_v2";
  const { SLOT_TIMES, localISO, isPastSlot, effectiveStatus, loadAppointments: readStoredAppointments, saveAppointments: writeStoredAppointments, validateAppointment, cancelAppointment, toCSV } = window.CalendraCore;
  const state = { view: "overview", selectedTime: "", pendingBooking: null, pendingCancelId: null, search: "", filter: "all" };
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const els = {
    sidebar: $("#sidebar"), navItems: $$(".nav-item"), views: $$(".view"), breadcrumb: $("#breadcrumbCurrent"),
    form: $("#bookingForm"), name: $("#fullName"), email: $("#email"), phone: $("#phone"), title: $("#appointmentTitle"),
    date: $("#appointmentDate"), slots: $("#timeSlots"), slotDateLabel: $("#slotDateLabel"), notes: $("#notes"),
    notesCount: $("#notesCount"), toastRegion: $("#toastRegion"), confirmModal: $("#confirmModal"), cancelModal: $("#cancelModal"),
    modalConfirm: $("#modalConfirm"), cancelConfirm: $("#cancelConfirm")
  };

  const pad = n => String(n).padStart(2, "0");
  const parseISO = value => { const [y,m,d] = String(value || "").split("-").map(Number); return new Date(y, (m || 1)-1, d || 1, 12, 0, 0); };
  const fmtDate = value => value ? parseISO(value).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}) : "Choose a date";
  const fmtLongDate = value => value ? parseISO(value).toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short",year:"numeric"}) : "Choose a date";
  const fmtTime = value => { if (!value) return "Choose a slot"; const [h,m] = value.split(":").map(Number); return new Date(2000,0,1,h,m).toLocaleTimeString("en-IN",{hour:"numeric",minute:"2-digit",hour12:true}); };
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const initials = name => String(name || "?").trim().split(/\s+/).slice(0,2).map(s => s[0] || "").join("").toUpperCase();
  const makeId = () => `CAL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
  const startOfToday = () => localISO();
  const sortBookings = list => [...list].sort((a,b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));

  let storageReadFailed = false;
  function loadAppointments() {
    try {
      return readStoredAppointments(localStorage, STORAGE_KEY);
    } catch {
      storageReadFailed = true;
      console.warn("Calendra could not read saved appointments from browser storage.");
      return [];
    }
  }
  let appointments = loadAppointments();
  function saveAppointments(nextAppointments) {
    try {
      writeStoredAppointments(localStorage, STORAGE_KEY, nextAppointments);
      return true;
    } catch {
      console.error("Calendra could not save appointments to browser storage.");
      toast("Storage unavailable","Your browser could not save this change. Check storage permissions or available space.","error");
      return false;
    }
  }
  function updateStatuses() {
    const updated = appointments.map(a => {
      if (a.status === "cancelled") return a;
      const status = effectiveStatus(a);
      return status === a.status ? a : {...a,status};
    });
    if (updated.some((appointment, index) => appointment !== appointments[index]) && saveAppointments(updated)) {
      appointments = updated;
    }
  }
  function toast(title,message,type="success") {
    const node = document.createElement("div");
    node.className = `toast ${type === "error" ? "error" : ""}`;
    node.innerHTML = `<span class="toast-mark" aria-hidden="true">${type === "error" ? "!" : "✓"}</span><div><strong>${escapeHTML(title)}</strong><p>${escapeHTML(message)}</p></div>`;
    els.toastRegion.append(node);
    window.setTimeout(() => { node.classList.add("toast-out"); window.setTimeout(()=>node.remove(),220); }, 3600);
  }
  function go(view) {
    if (!["overview","book","appointments"].includes(view)) return;
    state.view = view;
    els.views.forEach(section => {
      const active = section.id === `${view}View`;
      section.classList.toggle("active",active);
      section.hidden = !active;
    });
    els.navItems.forEach(button => {
      const active = button.dataset.view === view;
      button.classList.toggle("active",active);
      if (active) button.setAttribute("aria-current","page"); else button.removeAttribute("aria-current");
    });
    els.breadcrumb.textContent = view === "book" ? "New appointment" : view === "appointments" ? "Appointments" : "Overview";
    els.sidebar.classList.remove("open");
    $("#mobileMenu").setAttribute("aria-expanded","false");
    if (view === "overview") renderOverview();
    if (view === "appointments") renderAppointments();
    if (view === "book") { renderSlots(); updateSummary(); }
    window.scrollTo({top:0,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
  }
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY,theme); } catch {}
    const dark = theme === "dark";
    $("#themeIcon").textContent = dark ? "☼" : "◐";
    $("#themeToggle").setAttribute("aria-label",dark ? "Switch to light theme" : "Switch to dark theme");
    $('meta[name="theme-color"]').content = dark ? "#141414" : "#f3f3f1";
  }
  function statusLabel(status) { return status.charAt(0).toUpperCase()+status.slice(1); }
  function emptyState(title,copy,buttonText,view) {
    return `<div class="empty-state"><div class="empty-symbol">◷</div><h3>${escapeHTML(title)}</h3><p>${escapeHTML(copy)}</p>${buttonText ? `<button class="button button-primary" data-go="${view}">${escapeHTML(buttonText)} <span>→</span></button>` : ""}</div>`;
  }
  function appointmentRow(a,managed=false) {
    const status = effectiveStatus(a);
    const date = `<div class="date-copy"><strong>${escapeHTML(fmtLongDate(a.date))}</strong><small>${escapeHTML(fmtTime(a.time))}</small></div>`;
    const actions = status === "upcoming" ? `<div class="row-actions"><button class="small-action danger" data-cancel="${escapeHTML(a.id)}" aria-label="Cancel ${escapeHTML(a.title)}">Cancel</button></div>` : `<div class="row-actions"><span class="muted-action">—</span></div>`;
    return `<article class="appointment-row" data-id="${escapeHTML(a.id)}">
      <div class="appointment-main"><span class="appointment-monogram" aria-hidden="true">${escapeHTML(initials(a.title))}</span><div class="appointment-copy"><strong title="${escapeHTML(a.title)}">${escapeHTML(a.title)}</strong><small>${escapeHTML(a.name)} · ${escapeHTML(a.email)}</small></div></div>
      ${date}<div class="status-cell"><span class="status-pill ${status}">${statusLabel(status)}</span></div>${managed ? actions : `<div class="row-actions"><button class="small-action" data-go="appointments">Details ↗</button></div>`}
    </article>`;
  }
  function renderOverview() {
    updateStatuses();
    const statuses = appointments.map(a => ({...a,status:effectiveStatus(a)}));
    $("#totalStat").textContent = String(appointments.length).padStart(2,"0");
    $("#upcomingStat").textContent = String(statuses.filter(a=>a.status==="upcoming").length).padStart(2,"0");
    $("#completedStat").textContent = String(statuses.filter(a=>a.status==="completed").length).padStart(2,"0");
    $("#cancelledStat").textContent = String(statuses.filter(a=>a.status==="cancelled").length).padStart(2,"0");
    $("#navCount").textContent = statuses.filter(a=>a.status==="upcoming").length;
    const upcoming = sortBookings(statuses.filter(a=>a.status==="upcoming")).slice(0,4);
    $("#upcomingList").innerHTML = upcoming.length ? upcoming.map(a=>appointmentRow(a)).join("") : emptyState("Nothing on the calendar yet","A little planning goes a long way. Create your first appointment to get started.","Create appointment","book");
    renderHeroCalendar();
    setDateLabels();
  }
  function renderHeroCalendar() {
    const now = new Date(), y = now.getFullYear(), m = now.getMonth(), first = new Date(y,m,1), last = new Date(y,m+1,0);
    $("#heroMonth").textContent = now.toLocaleDateString("en-IN",{month:"long",year:"numeric"}).toUpperCase();
    const start = (first.getDay()+6)%7;
    const total = Math.ceil((start+last.getDate())/7)*7;
    let html = "";
    for(let i=0;i<total;i++) {
      const day = i-start+1;
      if(day<1 || day>last.getDate()) { html += "<i></i>"; continue; }
      const date = `${y}-${pad(m+1)}-${pad(day)}`;
      const has = appointments.some(a=>a.date===date && a.status!=="cancelled");
      html += `<i class="${date===localISO()?"selected":""} ${has?"booked":""}">${day}</i>`;
    }
    $("#heroCalendar").innerHTML = html;
  }
  function renderAppointments() {
    updateStatuses();
    const query = state.search.trim().toLowerCase();
    const filtered = sortBookings(appointments).filter(a => {
      const status = effectiveStatus(a);
      const matchesStatus = state.filter === "all" || state.filter === status;
      const matchesSearch = !query || [a.name,a.email,a.phone,a.title,a.notes,a.date,a.time].some(v=>String(v||"").toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
    $("#appointmentsList").innerHTML = filtered.length ? filtered.map(a=>appointmentRow(a,true)).join("") : emptyState("No matching appointments","Try changing your search or filter, or create a new booking.","New appointment","book");
    $("#listFooter").textContent = `Showing ${filtered.length} of ${appointments.length} appointment${appointments.length===1?"":"s"}`;
    $("#navCount").textContent = appointments.filter(a=>effectiveStatus(a)==="upcoming").length;
    setDateLabels();
  }
  function setDateLabels() {
    const label = new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
    ["todayLabel","bookTodayLabel","appointmentsTodayLabel"].forEach(id=>{const el=$("#"+id);if(el)el.textContent=label;});
  }
  function sameSlot(date,time,exceptId=null) {
    return appointments.some(a=>a.id!==exceptId && a.date===date && a.time===time && a.status!=="cancelled" && effectiveStatus(a)==="upcoming");
  }
  function renderSlots() {
    const date = els.date.value;
    state.selectedTime = state.selectedTime && !sameSlot(date,state.selectedTime) && !isPastSlot(date,state.selectedTime) ? state.selectedTime : "";
    els.slotDateLabel.textContent = date ? parseISO(date).toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"}) : "Choose a date";
    if (!date) { els.slots.innerHTML = '<div class="slot-placeholder">Select a date to see available times.</div>'; updateSummary(); return; }
    if (date < startOfToday()) { els.slots.innerHTML = '<div class="slot-placeholder">That date has passed. Choose today or a future date.</div>'; updateSummary(); return; }
    const available = SLOT_TIMES.filter(time=>!sameSlot(date,time) && !isPastSlot(date,time));
    if (!available.length) { els.slots.innerHTML = '<div class="slot-placeholder">All slots are booked for this date. Try another day.</div>'; updateSummary(); return; }
    els.slots.innerHTML = SLOT_TIMES.map(time=>{
      const booked = sameSlot(date,time), past = isPastSlot(date,time), disabled = booked||past;
      const selected = state.selectedTime===time;
      return `<button type="button" class="time-slot ${selected?"selected":""}" data-time="${time}" ${disabled?"disabled":""} aria-pressed="${selected}" title="${booked?"Already booked":past?"Time has passed":`Select ${fmtTime(time)}`}">${fmtTime(time)}${booked?" · Full":""}</button>`;
    }).join("");
    updateSummary();
  }
  function updateSummary() {
    $("#summaryName").textContent = els.name.value.trim() || "Your name";
    $("#summaryTitle").textContent = els.title.value.trim() || "Not set";
    $("#summaryDate").textContent = els.date.value ? fmtLongDate(els.date.value) : "Choose a date";
    $("#summaryTime").textContent = fmtTime(state.selectedTime);
    $("#notesCount").textContent = `${els.notes.value.length} / 300`;
  }
  function setError(id,message,input) {
    const target=$("#"+id); if(target)target.textContent=message;
    if(input) { if(message) input.setAttribute("aria-invalid","true"); else input.removeAttribute("aria-invalid"); }
  }
  function validateForm() {
    const errors = validateAppointment({
      name: els.name.value,
      email: els.email.value,
      phone: els.phone.value,
      title: els.title.value,
      date: els.date.value,
      time: state.selectedTime,
      notes: els.notes.value
    }, appointments);
    const fields = {
      name: ["nameError", els.name],
      email: ["emailError", els.email],
      phone: ["phoneError", els.phone],
      title: ["titleError", els.title],
      date: ["dateError", els.date]
    };
    Object.entries(fields).forEach(([key, [errorId, input]]) => setError(errorId, errors[key] || "", input));
    setError("timeError", errors.time || "");
    if (Object.keys(errors).length) {
      const firstInvalid = $("[aria-invalid='true']");
      if (firstInvalid) firstInvalid.focus({preventScroll:false});
      toast("Check your details","A few fields need your attention before you can continue.","error");
      return false;
    }
    return true;
  }
  function openBookingReview() {
    if (state.pendingBooking) return;
    const a={id:makeId(),name:els.name.value.trim(),email:els.email.value.trim(),phone:els.phone.value.trim(),title:els.title.value.trim(),date:els.date.value,time:state.selectedTime,notes:els.notes.value.trim(),status:"upcoming",createdAt:new Date().toISOString()};
    state.pendingBooking=a;
    $("#modalTitle").textContent="Confirm your appointment";
    $("#modalMessage").textContent="Take one last look. Your selected time will be saved in this browser.";
    $("#modalIcon").textContent="✳";
    $("#modalSummary").innerHTML=[
      ["Appointment",a.title],["Attendee",a.name],["Date",fmtLongDate(a.date)],["Time",fmtTime(a.time)],["Email",a.email]
    ].map(([k,v])=>`<div class="modal-summary-row"><span>${k}</span><strong>${escapeHTML(v)}</strong></div>`).join("");
    $("#modalConfirm").textContent="Confirm booking →";
    if(typeof els.confirmModal.showModal==="function")els.confirmModal.showModal();else if(confirm(`Confirm ${a.title} on ${fmtLongDate(a.date)} at ${fmtTime(a.time)}?`))commitBooking();
  }
  function commitBooking() {
    const a=state.pendingBooking;
    if(!a)return;
    let latest;
    try { latest=readStoredAppointments(localStorage,STORAGE_KEY); }
    catch { toast("Storage unavailable","Saved appointments could not be checked. Your booking was not saved.","error");return; }
    if(Object.keys(validateAppointment(a,latest)).length) {
      appointments=latest;
      state.pendingBooking=null;
      if(els.confirmModal.open)els.confirmModal.close("keep");
      state.selectedTime="";
      renderSlots();
      toast("Slot no longer available","The date or time is no longer available. Choose another slot.","error");
      return;
    }
    const updated=[...latest,a];
    if(!saveAppointments(updated))return;
    appointments=updated;
    state.pendingBooking=null;
    if(els.confirmModal.open)els.confirmModal.close("confirm");
    els.form.reset();state.selectedTime="";
    $$(".field-error").forEach(e=>e.textContent="");$$("[aria-invalid]").forEach(e=>e.removeAttribute("aria-invalid"));
    renderSlots();updateSummary();renderOverview();toast("Appointment confirmed","Your appointment has been added to this browser's schedule.");
    go("overview");
  }
  function askCancel(id) {
    const a=appointments.find(x=>x.id===id);
    if(!a)return;
    state.pendingCancelId=id;
    $("#cancelMessage").textContent=`“${a.title}” on ${fmtLongDate(a.date)} at ${fmtTime(a.time)} will be marked as cancelled.`;
    if(typeof els.cancelModal.showModal==="function")els.cancelModal.showModal();
    else if(confirm(`Cancel ${a.title}?`))commitCancel();
  }
  function commitCancel() {
    const id=state.pendingCancelId;
    let latest;
    try { latest=readStoredAppointments(localStorage,STORAGE_KEY); }
    catch { toast("Storage unavailable","Saved appointments could not be checked. No cancellation was made.","error");return; }
    const appointment=latest.find(x=>x.id===id);
    if(!appointment || effectiveStatus(appointment)!=="upcoming") {
      appointments=latest;
      state.pendingCancelId=null;
      if(els.cancelModal.open)els.cancelModal.close("keep");
      renderOverview();renderAppointments();
      toast("Appointment unavailable","This appointment can no longer be cancelled.","error");
      return;
    }
    const updated=cancelAppointment(latest,id);
    if(!updated || !saveAppointments(updated))return;
    appointments=updated;
    state.pendingCancelId=null;
    if(els.cancelModal.open)els.cancelModal.close("confirm");
    renderOverview();renderAppointments();renderSlots();
    toast("Appointment cancelled","The time slot is now available again.");
  }
  function exportCSV() {
    const headers=["ID","Name","Email","Phone","Title","Date","Time","Status","Notes","Created at"];
    const rows=sortBookings(appointments).map(a=>[a.id,a.name,a.email,a.phone,a.title,a.date,fmtTime(a.time),effectiveStatus(a),a.notes,a.createdAt]);
    const csv=toCSV(headers,rows);
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download=`calendra-appointments-${localISO()}.csv`;document.body.append(link);link.click();link.remove();URL.revokeObjectURL(url);
    toast("Export ready",`${rows.length} appointment${rows.length===1?"":"s"} exported as CSV.`);
  }
  function bindEvents() {
    els.navItems.forEach(button=>button.addEventListener("click",()=>go(button.dataset.view)));
    $("#mobileMenu").addEventListener("click",()=>{
      const open=els.sidebar.classList.toggle("open");$("#mobileMenu").setAttribute("aria-expanded",String(open));
    });
    document.addEventListener("click",event=>{
      const goButton=event.target.closest("[data-go]");
      if(goButton && !goButton.matches("button.nav-item"))go(goButton.dataset.go);
      const slot=event.target.closest("[data-time]");
      if(slot&&!slot.disabled){state.selectedTime=slot.dataset.time;renderSlots();const selected=$(`[data-time="${state.selectedTime}"]`);if(selected)selected.focus({preventScroll:true});}
      const cancel=event.target.closest("[data-cancel]");
      if(cancel)askCancel(cancel.dataset.cancel);
      if(window.innerWidth<=900 && els.sidebar.classList.contains("open") && !event.target.closest("#sidebar")&&!event.target.closest("#mobileMenu")){els.sidebar.classList.remove("open");$("#mobileMenu").setAttribute("aria-expanded","false");}
    });
    $("#themeToggle").addEventListener("click",()=>setTheme(document.documentElement.dataset.theme==="dark"?"light":"dark"));
    $("#helpButton").addEventListener("click",()=>toast("Welcome to Calendra","Create a booking, choose an available slot, then manage your appointments from one workspace."));
    $("#profileMenu").addEventListener("click",()=>toast("Personal workspace","This demo stores bookings in this browser. It does not have accounts or cloud sync."));
    els.form.addEventListener("submit",event=>{event.preventDefault();if(validateForm())openBookingReview();});
    [els.name,els.email,els.phone,els.title,els.notes].forEach(input=>input.addEventListener("input",updateSummary));
    els.date.addEventListener("change",()=>{state.selectedTime="";setError("dateError","",els.date);setError("timeError","");renderSlots();});
    els.form.addEventListener("input",event=>{
      const input=event.target;
      const map={fullName:"nameError",email:"emailError",phone:"phoneError",appointmentTitle:"titleError",appointmentDate:"dateError"};
      if(map[input.name])setError(map[input.name],"",input);
    });
    $("#searchInput").addEventListener("input",event=>{state.search=event.target.value;renderAppointments();});
    $("#statusFilter").addEventListener("change",event=>{state.filter=event.target.value;renderAppointments();});
    $("#exportButton").addEventListener("click",exportCSV);
    els.modalConfirm.addEventListener("click",event=>{event.preventDefault();commitBooking();});
    els.cancelConfirm.addEventListener("click",event=>{event.preventDefault();commitCancel();});
    [els.confirmModal,els.cancelModal].forEach(dialog=>dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close("keep");}));
    document.addEventListener("keydown",event=>{
      if(event.key==="Escape")els.sidebar.classList.remove("open");
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){event.preventDefault();go("appointments");$("#searchInput").focus();}
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="n"){event.preventDefault();go("book");els.name.focus();}
    });
    window.addEventListener("storage",event=>{
      if(event.key===STORAGE_KEY){appointments=loadAppointments();renderOverview();renderAppointments();renderSlots();}
    });
    window.addEventListener("error",()=>{
      toast("Something went wrong","Please refresh the page and try again.","error");
    });
    window.addEventListener("unhandledrejection",()=>{
      toast("Something went wrong","Please refresh the page and try again.","error");
    });
  }
  function init() {
    let theme="light";try{theme=localStorage.getItem(THEME_KEY)||"light";}catch{}
    setTheme(theme==="dark"?"dark":"light");
    const minDate=startOfToday();els.date.min=minDate;
    $("#todayLabel").textContent=new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
    bindEvents();renderOverview();renderAppointments();renderSlots();updateSummary();
    if(storageReadFailed)toast("Saved appointments unavailable","Your browser could not load appointments from local storage.","error");
  }
  init();
})();