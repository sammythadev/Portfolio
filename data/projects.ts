export type Project = {
  title: string;
  description: string;
  tech: string[];
  demoUrl: string;
  codeUrl: string;
  /** Optional local path under /public. A generated gradient cover is used when absent. */
  image?: string;
};

export const projects: Project[] = [
  {
    title: "DeFi Yield Aggregator",
    description: "Automated yield farming across multiple protocols",
    tech: ["Solidity", "React", "Node.js"],
    demoUrl: "#",
    codeUrl: "#",
  },
  {
    title: "NFT Marketplace",
    description: "Full-featured NFT platform with minting and auctions",
    tech: ["Next.js", "IPFS", "Web3.js"],
    demoUrl: "#",
    codeUrl: "#",
  },
];