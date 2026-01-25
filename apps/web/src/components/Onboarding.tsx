'use client';

import { useState } from 'react';

// Token icon URLs
const TOKEN_ICONS = {
  USDC: 'https://assets-cdn.trustwallet.com/blockchains/base/assets/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/logo.png',
  MFER: 'https://coin-images.coingecko.com/coins/images/36550/small/mfercoin-logo.png',
  BNKR: 'https://assets-cdn.trustwallet.com/blockchains/base/assets/0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b/logo.png',
  DRB: 'https://coin-images.coingecko.com/coins/images/54784/small/1000143570.jpg',
  UNISWAP: 'https://assets-cdn.trustwallet.com/blockchains/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png',
  AERODROME: 'https://assets.coingecko.com/coins/images/31745/small/token.png',
};

interface OnboardingProps {
  darkMode: boolean;
  onComplete: (dontShowAgain: boolean) => void;
  onSkip: () => void;
  isConnected: boolean;
  onConnect: (() => void) | undefined;
}

interface StepContent {
  image?: string;
  title: string;
  content: React.ReactNode;
}

function TokenIcon({ token, size = 24 }: { token: keyof typeof TOKEN_ICONS; size?: number }) {
  return (
    <img
      src={TOKEN_ICONS[token]}
      alt={token}
      className="rounded-full inline-block"
      style={{ width: size, height: size }}
    />
  );
}

function DiceIcon({ size = 24, value = 3 }: { size?: number; value?: number }) {
  // Dot positions for each dice value
  const dotPositions: Record<number, Array<[number, number]>> = {
    1: [[12, 12]],
    2: [[7, 7], [17, 17]],
    3: [[7, 7], [12, 12], [17, 17]],
    4: [[7, 7], [17, 7], [7, 17], [17, 17]],
    5: [[7, 7], [17, 7], [12, 12], [7, 17], [17, 17]],
    6: [[7, 7], [17, 7], [7, 12], [17, 12], [7, 17], [17, 17]],
  };
  const dots = dotPositions[value] || dotPositions[3];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="inline-block"
    >
      <rect x="2" y="2" width="20" height="20" rx="3" fill="#dc2626" />
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="2.5" fill="white" />
      ))}
    </svg>
  );
}

export function Onboarding({
  darkMode,
  onComplete,
  onSkip,
  isConnected,
  onConnect,
}: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const steps: StepContent[] = [
    // Step 1: Welcome
    {
      image: '/logo-transparent.png',
      title: 'Welcome to mferROLL!',
      content: (
        <div className="space-y-6 py-4">
          <p className="text-center text-lg">
            The funnest way to swap USDC for MFER, BNKR, and DRB all at once!
          </p>
          <div className="flex items-center justify-center gap-3">
            <TokenIcon token="USDC" size={56} />
            <span className="text-3xl">→</span>
            <div className="flex gap-2">
              <TokenIcon token="MFER" size={56} />
              <TokenIcon token="BNKR" size={56} />
              <TokenIcon token="DRB" size={56} />
            </div>
          </div>
        </div>
      ),
    },
    // Step 2: Deposit - show Game Balance concept
    {
      image: 'usdc-large',
      title: 'Make Your First Deposit',
      content: (
        <div className="space-y-8 py-4">
          <div className="flex justify-center">
            <div className={`rounded-2xl px-6 py-4 flex items-center gap-3 ${darkMode ? 'bg-gray-600' : 'bg-gray-200'}`}>
              <span className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>0.00</span>
              <TokenIcon token="USDC" size={40} />
            </div>
          </div>
          <p className="text-center font-medium text-lg">
            Click the USDC at the top and make a $4 deposit and get going!
          </p>
        </div>
      ),
    },
    // Step 3: How It Works - meme icons in image area
    {
      image: 'meme-icons',
      title: 'Roll the Dice, Win Meme Coins!',
      content: (
        <div className="space-y-6 py-4">
          {/* Doubles Example - DOUBLES first, then dice */}
          <div className="flex items-center justify-center gap-4">
            <span className="text-green-500 font-bold text-2xl">DOUBLES</span>
            <div className="flex gap-2">
              <DiceIcon size={48} value={5} />
              <DiceIcon size={48} value={5} />
            </div>
            <span className="text-lg font-medium">Win 2x!</span>
          </div>
          {/* 7/11 Example - dice first, then 7/11 */}
          <div className="flex items-center justify-center gap-4">
            <div className="flex gap-2">
              <DiceIcon size={48} value={3} />
              <DiceIcon size={48} value={4} />
            </div>
            <span className="text-green-500 font-bold text-2xl">7/11</span>
            <span className="text-lg font-medium">Win 0.5x!</span>
          </div>
        </div>
      ),
    },
    // Step 4: The Economics
    {
      image: '/mferroll_number_of_rolls.png',
      title: '$4 Gets You Rolling',
      content: (
        <div className="space-y-4">
          <div className="space-y-2 text-center text-lg">
            <p><strong>Minimum deposit:</strong> $4 USDC</p>
            <p><strong>Each roll:</strong> $0.40</p>
            <p className="text-green-500 font-bold text-xl">
              Have fun ROLLING and a TON of meme coins at the FAIR MARKET price!
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Powered by</span>
            <img src="https://assets-cdn.trustwallet.com/blockchains/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png" alt="Uniswap" className="w-8 h-8 rounded-full" />
            <img src="https://assets.coingecko.com/coins/images/31745/small/token.png" alt="Aerodrome" className="w-8 h-8 rounded-full" />
          </div>
        </div>
      ),
    },
    // Step 5: Grok AI - with large coins image (final step)
    {
      title: 'Grok Gets His Beak Wet!',
      content: (
        <div className="space-y-4">
          <div className="flex justify-center">
            <img
              src="/grokai_mfer_coins.png"
              alt="Grok AI"
              className="w-56 h-56 object-contain"
            />
          </div>
          <p className="text-center">
            Grok gets his beak wet with mfer on every losing roll!
          </p>
          <div className="flex items-center justify-center gap-2">
            <TokenIcon token="MFER" size={32} />
            <span className="font-medium">→ Grok Wallet</span>
          </div>
        </div>
      ),
    },
  ];

  const totalSteps = steps.length;
  const isLastStep = currentStep === totalSteps - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete(dontShowAgain);
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  const handleDotClick = (index: number) => {
    setCurrentStep(index);
  };

  const currentContent = steps[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/85"
        onClick={onSkip}
      />

      {/* Card */}
      <div
        className={`relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${
          darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Skip button */}
        <button
          onClick={onSkip}
          className={`absolute top-4 right-4 z-10 text-sm font-medium transition-colors ${
            darkMode
              ? 'text-gray-400 hover:text-white'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Skip →
        </button>

        {/* Content - fixed height for consistency */}
        <div className="p-6 pt-10 h-[520px] flex flex-col">
          {/* Image area - always same height */}
          <div className="h-44 flex items-center justify-center">
            {currentContent.image === 'meme-icons' ? (
              <div className="flex items-center justify-center gap-6">
                <TokenIcon token="MFER" size={80} />
                <TokenIcon token="BNKR" size={80} />
                <TokenIcon token="DRB" size={80} />
              </div>
            ) : currentContent.image === 'usdc-large' ? (
              <img
                src={TOKEN_ICONS.USDC}
                alt="USDC"
                style={{ width: 100, height: 100, borderRadius: '50%' }}
                className="object-contain"
              />
            ) : currentContent.image && (
              <img
                src={currentContent.image}
                alt=""
                style={
                  currentContent.image.includes('logo-transparent')
                    ? { width: 160, height: 160, borderRadius: 12 }
                    : currentContent.image.includes('number_of_rolls')
                      ? { width: 280, height: 140, borderRadius: 8 }
                      : { width: 80, height: 80, borderRadius: '50%' }
                }
                className="object-contain"
              />
            )}
          </div>

          {/* Title - fixed position */}
          <h2 className="text-2xl font-bold text-center py-4">
            {currentContent.title}
          </h2>

          {/* Step content - fills remaining space */}
          <div className={`flex-1 flex flex-col justify-start ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {currentContent.content}
          </div>
        </div>

        {/* Footer */}
        <div className={`p-4 pt-0 space-y-4 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          {/* Don't show again checkbox - only on last step */}
          {isLastStep && (
            <label className="flex items-center justify-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Don't show me this again
              </span>
            </label>
          )}

          {/* Navigation row */}
          <div className="flex items-center justify-between">
            {/* Previous button or spacer */}
            <div className="w-20">
              {currentStep > 0 && (
                <button
                  onClick={handlePrevious}
                  className={`text-sm font-medium transition-colors ${
                    darkMode
                      ? 'text-gray-400 hover:text-white'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  ← Back
                </button>
              )}
            </div>

            {/* Navigation dots */}
            <div className="flex gap-2">
              {steps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => handleDotClick(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentStep
                      ? 'bg-purple-500'
                      : darkMode
                        ? 'bg-gray-600 hover:bg-gray-500'
                        : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                  aria-label={`Go to step ${index + 1}`}
                />
              ))}
            </div>

            {/* Next/Connect/Let's Roll button */}
            <div className="w-20 flex justify-end">
              {isLastStep ? (
                isConnected ? (
                  <button
                    onClick={handleNext}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Let's Roll!
                  </button>
                ) : onConnect ? (
                  <button
                    onClick={() => {
                      onConnect();
                      onComplete(dontShowAgain);
                    }}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Connect
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Let's Roll!
                  </button>
                )
              ) : (
                <button
                  onClick={handleNext}
                  className={`text-sm font-medium transition-colors ${
                    darkMode
                      ? 'text-purple-400 hover:text-purple-300'
                      : 'text-purple-600 hover:text-purple-500'
                  }`}
                >
                  Next →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
