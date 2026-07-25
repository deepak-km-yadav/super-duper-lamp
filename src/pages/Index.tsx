import { AIConcierge } from '@/components/chat';
import NavBar from '@/components/NavBar';

const Index = () => {
  return (
    <div className="h-screen flex flex-col bg-black relative overflow-hidden">
      {/* Ambient background blobs */}
      <div className="liquid-bg-blob blob-a" />
      <div className="liquid-bg-blob blob-b" />
      <div className="liquid-bg-blob blob-c" />
      <div className="liquid-bg-vignette" />

      <NavBar />

      <div className="flex-1 relative overflow-hidden unchat-stage">
        <AIConcierge />
      </div>
    </div>
  );
};

export default Index;
