import NavBar from '@/components/NavBar';
import MainLayout from '@/chatterbox/components/layout/MainLayout';

const ChatterboxPage = () => {
  return (
    <div className="h-screen flex flex-col bg-black text-white overflow-hidden">
      {/* Ambient background matching designinc theme */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(130% 70% at 20% 25%, hsl(218 92% 58% / 0.18), transparent 56%), ' +
              'radial-gradient(110% 65% at 80% 35%, hsl(227 88% 54% / 0.15), transparent 58%), ' +
              'radial-gradient(100% 80% at 50% 80%, hsl(220 96% 44% / 0.12), transparent 62%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at center, transparent 45%, hsl(230 54% 3% / 0.4) 100%)',
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col h-full">
        <NavBar />

        {/* Chatterbox occupies full remaining height */}
        <div id="chatterbox-root" className="flex-1 overflow-hidden bg-transparent">
          <MainLayout />
        </div>
      </div>
    </div>
  );
};

export default ChatterboxPage;
