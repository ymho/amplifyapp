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
import MakeInquiries from './pages/MakeInquiries';
import Inquiries from './pages/Inquiries';
import InquiryDetail from './pages/InquiryDetail';

Amplify.configure(awsExports);

// 仮ページ
const Home = () => <View padding="1rem">ホーム</View>;

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
              <Route path="/" element={<Home />} />
              <Route path="/inquiries/new" element={<MakeInquiries />} />
              <Route path="/inquiries" element={<Inquiries />} />
              <Route path="/inquiries/:id" element={<InquiryDetail />} />
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
