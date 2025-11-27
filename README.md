# n8n-nodes-subworkflow-ai

An AI document processing n8n node for large documents, built for RAG and Structured Output Workflows.

## Features
* **Handles Documents up to 1gb** Protect the stability of your instance by offloading CPU intensive document processing work.
* **Granular Page Retrieval** No need to hold everything in memory. Fetches only the pages you need in the formats you need.
* **Automated Embeddings and Search** Save time by avoiding adhoc embedding workflows for every project.
* **Small and High Frequency Use-cases also Supported** Unmetered page counts and retrievals help build more durable workflows without surprises.

## Installation

### Cloud and Self-hosted
Install via the **Settings > Community Nodes** page in your n8n instance.

### Self-hosted CLI
```
npm install n8n-nodes-subworkflow-ai
```

## Credentials

You will need a Subworkflow.AI account and workspace API key to use this node.
* Sign up at https://subworkflow.ai
* Go to **Workspaces > Settings > Keys > Create API Key**
* Copy this API Key

## Licence

MIT

## Resources

* [Subworkflow.AI Getting Started Gude](https://docs.subworkflow.ai/getting-started)
* [Official Subworkflow.AI API Reference](https://docs.subworkflow.ai/category/api-reference)
* [Subworkflow JS SDK for programmatic usage](https://github.com/Subworkflow-AI/subworkflow-js-sdk)