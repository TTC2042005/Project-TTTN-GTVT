import { useRouter } from 'next/router';
import Nav from '../components/Nav';
import '../styles/global.css';

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const isAdminWorkspace = router.pathname.startsWith('/admin');

  return (
    <>
      {!isAdminWorkspace && <Nav />}
      <Component {...pageProps} />
    </>
  );
}
