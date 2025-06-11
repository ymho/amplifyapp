import { View } from '@aws-amplify/ui-react';
import Header from './Header';
import Footer from './Footer';

const Layout = ({ children }) => {
  return (
    <View minHeight="100vh" display="flex" flexDirection="column">
      <Header />
      <View as="main" flex="1" padding="1rem">
        {children}
      </View>
      <Footer />
    </View>
  );
};

export default Layout;
