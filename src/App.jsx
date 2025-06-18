import React, { useEffect, useState } from "react";
import { withAuthenticator, View, Flex } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { Amplify } from "aws-amplify";
import awsExports from "./aws-exports";
import "./i18n";
import "./App.css";

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { getCurrentUserInfo } from "./utils/auth";
import Header from "./components/Header";
import Footer from "./components/Footer";
import InquiryNew from './pages/InquiryNew';
import Inquiries from './pages/Inquiries';
import InquiryDetail from './pages/InquiryDetail';
import LedgerNew from './pages/LedgerNew';
import ServiceMaster from './pages/ServiceMaster';
import Ledgers from './pages/Ledgers';
import LedgerDetail from "./pages/LedgerDetail";
import Home from "./pages/Home"

Amplify.configure(awsExports);

function App({ signOut, user }) {
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    getCurrentUserInfo().then(setUserInfo).catch(console.error);
  }, []);

  if (!userInfo) return <View padding="2rem">読み込み中...</View>;

  return (
    <Router>
      <Flex direction="column" minHeight="100vh">
        <Header user={userInfo} signOut={signOut} />
        <Flex direction="row" flex="1">
          <View as="main" flex="1" padding="1rem" backgroundColor="#ffffff">
            <Routes>
              <Route path="/inquiries" element={<Inquiries user={userInfo} />} />
              <Route path="/inquiry/new" element={<InquiryNew user={userInfo} />} />
              <Route path="/inquiries/:id" element={<InquiryDetail user={userInfo} />} />
              {/* 他のページもここに追加 */}
              {/* <Route path="/ledgers" element={<Ledgers user={userInfo} />} /> */}
              <Route path="/" element={<Home user={userInfo} />} />
              <Route path="/ledgers" element={<Ledgers user={userInfo} />} />
              <Route path="/ledgers/:id" element={<LedgerDetail user={userInfo} />} />
              <Route path="/ledger/new" element={<LedgerNew user={userInfo} />} />
              {/* <Route path="/admin/ledgers" element={<AdminLedgers user={userInfo} />} /> */}
              {/* <Route path="/admin/inquiries" element={<AdminInquiries user={userInfo} />} /> */}
              <Route path="/service" element={<ServiceMaster user={userInfo} />} />
            </Routes>
          </View>
        </Flex>
        <Footer />
      </Flex>
    </Router>
  );
}

export default withAuthenticator(App, {
  signUpAttributes: ['family_name','given_name'],
});
