import React from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

function Hero() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className="hero">
      <div className="container">
        <h1 className="hero__title">{siteConfig.title}</h1>
        <p className="hero__subtitle">
          Multi-tenant WebSocket infrastructure. Deploy in your own cloud,
          connect your Kafka pipeline, deliver real-time data to thousands of
          clients with sub-millisecond fan-out.
        </p>
        <div style={{ marginTop: '2rem' }}>
          <Link
            className="button button--primary button--lg"
            to="/docs/quickstart"
          >
            Get Started in 5 Minutes
          </Link>
          <Link
            className="button button--outline button--lg"
            to="/docs/concepts/architecture"
            style={{ marginLeft: '1rem' }}
          >
            How It Works
          </Link>
        </div>
      </div>
    </header>
  );
}

const features = [
  {
    title: 'Deploy Anywhere (BYOC)',
    description:
      'Run Sukko in your own Kubernetes cluster — DOKS, GKE, EKS, or any conformant K8s. Your data never leaves your infrastructure.',
  },
  {
    title: 'Multi-Tenant by Design',
    description:
      'Isolate tenants at every layer — connections, channels, topics, and quotas. Shared or dedicated Kafka consumers per tenant.',
  },
  {
    title: 'Kafka-Native Ingestion',
    description:
      'Publish to Kafka/Redpanda, Sukko delivers to WebSocket clients. Three-layer protection: rate limiting, CPU backpressure, non-blocking broadcast.',
  },
  {
    title: 'Sub-Millisecond Fan-Out',
    description:
      'Sharded connection architecture with NATS broadcast bus. Subscription index eliminates O(N) scans — direct lookup of subscribers.',
  },
  {
    title: 'Channel Scoping',
    description:
      'Public, user-scoped, and group-scoped channels with JWT-based authorization. Per-tenant channel rules and routing.',
  },
  {
    title: 'Built-In Testing',
    description:
      'Integrated tester service with smoke, load, stress, soak, and validation test suites. SSE metrics streaming for real-time observability.',
  },
];

function Features() {
  return (
    <section className="container" style={{ padding: '2rem 0 4rem' }}>
      <div className="features">
        {features.map((feature) => (
          <div className="feature-card" key={feature.title}>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Home(): React.ReactElement {
  return (
    <Layout
      title="Multi-Tenant WebSocket Infrastructure"
      description="Deploy Sukko in your own cloud. Kafka-native ingestion, sub-millisecond fan-out, multi-tenant isolation."
    >
      <Hero />
      <Features />
    </Layout>
  );
}
