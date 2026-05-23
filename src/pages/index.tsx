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
    title: 'Deploy in Your Cloud (BYOC)',
    description:
      'Run Sukko in your own Kubernetes cluster — DOKS, GKE, EKS, or any conformant K8s. Your data never leaves your infrastructure. Helm charts and CLI tooling included.',
  },
  {
    title: 'Multi-Tenant from Day One',
    description:
      'Tenant isolation at every layer — connections, channels, Kafka topics, and database queries. Per-tenant JWT keys, channel rules, quotas, and connection limits. Not bolted on, built in.',
  },
  {
    title: 'Pluggable Backends',
    description:
      'Swap the message backend (direct, Kafka/Redpanda, NATS JetStream) and broadcast bus (NATS, Valkey) independently. Start simple with direct mode, move to Kafka for production — no code changes.',
  },
  {
    title: 'Kafka-Native Ingestion',
    description:
      'Publish to Kafka/Redpanda, Sukko delivers to WebSocket clients. Per-tenant topic routing, shared or dedicated consumers, three-layer backpressure protection.',
  },
  {
    title: 'Sub-Millisecond Fan-Out',
    description:
      'Sharded connection architecture with broadcast bus for inter-pod distribution. Subscription index eliminates O(N) scans — direct lookup of subscribers per channel.',
  },
  {
    title: 'Channel Access Control',
    description:
      'Public, user-scoped, and group-scoped channels enforced at the gateway via JWT claims. Per-tenant channel rules configurable through the provisioning API.',
  },
  {
    title: 'Built-In Test Suite',
    description:
      'Integrated tester service with smoke, load, stress, soak, and 9 validation suites. Orchestrated via the CLI — test locally or against remote deployments with context switching.',
  },
  {
    title: 'Multiple Transports',
    description:
      'WebSocket, Server-Sent Events (SSE), and push notifications (FCM for Android, APNs for iOS/macOS, Web Push for browsers). Same tenant isolation and channel rules across all transports.',
  },
  {
    title: 'Framework SDKs',
    description:
      'TypeScript SDK with first-class React, Vue, and Svelte bindings — token refresh, connection state, and subscriptions handled for you. More languages coming soon.',
  },
  {
    title: 'Observability',
    description:
      'Pre-built Grafana dashboards for connections, throughput, and per-tenant metrics. Prometheus metrics out of the box, structured log search via Loki.',
  },
  {
    title: 'Developer CLI',
    description:
      'Full-featured CLI for managing tenants, keys, rules, and deployments. Local dev with sukko init/up, context switching for remote environments, and integrated test orchestration.',
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
