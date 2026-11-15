import re
import sys

def main():
    with open('scripts/build_standalone.js', 'r', encoding='utf-8') as f:
        content = f.read()

    print("Original length:", len(content))
    
    # 1. Update pulse dot CSS if not present
    if '.pulse-dot' not in content:
        pulse_css = """    .pulse-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ea580c;
      animation: pulseAnim 1.2s infinite ease-in-out;
    }
    @keyframes pulseAnim {
      0%, 100% { transform: scale(0.9); opacity: 0.6; }
      50% { transform: scale(1.3); opacity: 1; box-shadow: 0 0 10px #f97316; }
    }
"""
        content = content.replace('/* Scrollbars */', pulse_css + '    /* Scrollbars */')

    with open('scripts/build_standalone.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("CSS check done.")

if __name__ == '__main__':
    main()
