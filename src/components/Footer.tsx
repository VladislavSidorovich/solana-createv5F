import { FC } from "react";
import tokentol from "../assets/img/tokentol.png";
import x from "../assets/img/icons8-x-50.png";
import t from "../assets/img/icons8-t.png";
import Image from "next/image";

export const Footer: FC = () => {
  return (
    <div className="">
      <footer className="footer mx-auto flex flex-row items-center justify-between bg-neutral p-2 text-neutral-content">
        <div className="pl-2">
          <div className="w-22 h-22 hidden sm:inline md:p-2">
            <Image 
              src={tokentol} 
              alt="TokenTol logo" 
              width={178} 
              height={88}
              className="hidden sm:inline"
            />
          </div>
        </div>

        <div className="flex items-center">
          {/* Email - текстом по центру */}
          <a 
            href="mailto:support@tokentol.com" 
            className="mx-4 hover:opacity-80 transition-opacity"
          >
            support@tokentol.com
          </a>
        </div>

        <div className="flex items-center space-x-4 pr-4">
          {/* Telegram */}
          <a 
            href="https://t.me/tokentol" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:opacity-80 transition-opacity"
          >
            <Image
              src={t}
              alt="Telegram"
              width={24}
              height={24}
            />
          </a>

          {/* Twitter/X */}
          <a 
            href="https://x.com/thetokentol" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:opacity-80 transition-opacity"
          >
            <Image
              src={x}
              alt="X (Twitter)"
              width={24}
              height={24}
            />
          </a>
        </div>
      </footer>
    </div>
  );
};