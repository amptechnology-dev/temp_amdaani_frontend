import React, { useState } from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import {
  Text,
  List,
  Divider,
  Button,
  useTheme,
  IconButton,
  Card,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Navbar from '../../components/Navbar';

const HelpSupport = () => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(null);

  const faqs = [
    {
      q: 'How do I create a new invoice?',
      a: 'Go to Sales > New Sale and fill in the customer and item details.',
    },
    {
      q: 'How do I manage my business profile?',
      a: 'Navigate to Account > Business Profile to update your details.',
    },
    {
      q: 'How can I upgrade my plan?',
      a: 'Go to Account > Plans & Pricing and choose the plan that suits you best.',
    },
  ];

  const toggleExpand = index => {
    setExpanded(expanded === index ? null : index);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Navbar title={'Help & Support'}/>
      <View style={styles.content}>
        {/* Header */}
        {/* <Text
          variant="titleLarge"
          style={[styles.title, { color: theme.colors.onSurface }]}
        >
          Help & Support
        </Text> */}
        <Text
          variant="bodyMedium"
          style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
        >
          Find answers or reach out to us
        </Text>

        {/* FAQ Section */}
        <Card
          style={[
            styles.card,
            { backgroundColor: theme.colors.elevation.level1 },
          ]}
        >
          <Card.Title
            title="FAQs"
            titleStyle={{ color: theme.colors.onSurface }}
          />
          <Card.Content>
            {faqs.map((item, index) => (
              <View key={index}>
                <List.Accordion
                  title={item.q}
                  expanded={expanded === index}
                  onPress={() => toggleExpand(index)}
                  titleStyle={{ color: theme.colors.onSurface }}
                  style={styles.accordion}
                >
                  <Text style={{ color: theme.colors.onSurfaceVariant }}>
                    {item.a}
                  </Text>
                </List.Accordion>
                {index < faqs.length - 1 && <Divider />}
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Contact Options */}
        <Card
          style={[
            styles.card,
            { backgroundColor: theme.colors.elevation.level1 },
          ]}
        >
          <Card.Title
            title="Contact Us"
            titleStyle={{ color: theme.colors.onSurface }}
          />
          <Card.Content>
            <List.Item
              title="Email Support"
              description="amptechnologysolution@gmail.com"
              left={props => (
                <List.Icon
                  {...props}
                  icon="email"
                  color={theme.colors.primary}
                />
              )}
              onPress={() =>
                Linking.openURL('mailto:amptechnologysolution@gmail.com')
              }
            />
            <Divider />
            <List.Item
              title="WhatsApp"
              description="+91 8697972001"
              left={props => (
                <List.Icon {...props} icon="whatsapp" color="#25D366" />
              )}
              onPress={() => Linking.openURL('https://wa.me/918697972001')}
            />
            <Divider />
            <List.Item
              title="Call Us"
              description="+91 8697972001"
              left={props => (
                <List.Icon
                  {...props}
                  icon="phone"
                  color={theme.colors.primary}
                />
              )}
              onPress={() => Linking.openURL('tel:+ +918697972001')}
            />
          </Card.Content>
        </Card>

        {/* Footer */}
        <Text
          variant="bodySmall"
          style={[styles.footer, { color: theme.colors.onSurfaceVariant }]}
        >
          We usually reply within 24 hours
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  title: {
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 16,
    opacity: 0.7,
  },
  card: {
    marginBottom: 20,
    borderRadius: 12,
  },
  accordion: {
    backgroundColor: 'transparent',
  },
  footer: {
    textAlign: 'center',
    marginTop: 12,
    opacity: 0.7,
  },
});

export default HelpSupport;
