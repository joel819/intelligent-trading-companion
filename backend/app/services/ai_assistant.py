"""
AI Assistant Service
Provides conversational AI capabilities for the Intelligent Trading Companion.
Uses OpenAI GPT to analyze trades, explain decisions, and answer trading questions.
"""

import os
import logging
from openai import OpenAI
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SYSTEM_PROMPT = """You are an AI trading assistant for an Intelligent Trading Companion platform.
You help users understand their trading bot's decisions, analyze market conditions, and provide trading insights.

Your capabilities include:
1. Explaining why specific trades were taken or rejected
2. Analyzing market conditions (trend, volatility, RSI, ADX, MACD)
3. Providing risk management advice
4. Answering questions about trading strategies (V75, V10, etc.)
5. Helping users understand technical indicators

Always be concise, professional, and data-driven in your responses.
When discussing trades, reference specific indicators and thresholds when available.
If you don't have specific data, be clear about what information would be needed.
"""


class AIAssistant:
    """AI-powered trading assistant using OpenAI."""
    
    def __init__(self):
        self.model = "gpt-4o-mini"  # Cost-effective model for trading chat
        self.conversation_history: List[Dict[str, str]] = []
        
    async def chat(
        self, 
        user_message: str, 
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Process a user message and return AI response.
        
        Args:
            user_message: The user's question or message
            context: Optional trading context (current positions, recent trades, indicators)
            
        Returns:
            AI assistant's response
        """
        try:
            # Build context message if provided
            context_message = ""
            if context:
                context_message = self._format_context(context)
            
            # Add user message to history
            full_message = f"{context_message}\n\nUser Question: {user_message}" if context_message else user_message
            self.conversation_history.append({"role": "user", "content": full_message})
            
            # Keep conversation history manageable (last 10 exchanges)
            if len(self.conversation_history) > 20:
                self.conversation_history = self.conversation_history[-20:]
            
            # Call OpenAI API
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    *self.conversation_history
                ],
                max_tokens=500,
                temperature=0.7
            )
            
            assistant_message = response.choices[0].message.content
            
            # Add assistant response to history
            self.conversation_history.append({"role": "assistant", "content": assistant_message})
            
            logger.info(f"AI Assistant responded to: {user_message[:50]}...")
            return assistant_message
            
        except Exception as e:
            logger.error(f"AI Assistant error: {e}")
            return f"I encountered an error processing your request: {str(e)}"
    
    def _format_context(self, context: Dict[str, Any]) -> str:
        """Format trading context for the AI."""
        parts = ["Current Trading Context:"]
        
        if "symbol" in context:
            parts.append(f"- Symbol: {context['symbol']}")
        if "price" in context:
            parts.append(f"- Current Price: {context['price']}")
        if "rsi" in context:
            parts.append(f"- RSI: {context['rsi']:.1f}")
        if "adx" in context:
            parts.append(f"- ADX: {context['adx']:.1f}")
        if "ma_slope" in context:
            parts.append(f"- MA Slope: {context['ma_slope']:.6f}")
        if "trend" in context:
            parts.append(f"- Trend: {context['trend']}")
        if "market_mode" in context:
            parts.append(f"- Market Mode: {context['market_mode']}")
        if "open_positions" in context:
            val = context['open_positions']
            count = len(val) if isinstance(val, list) else val
            parts.append(f"- Open Positions: {count}")
        if "recent_trades" in context:
            val = context['recent_trades']
            count = len(val) if isinstance(val, list) else val
            parts.append(f"- Recent Trades: {count}")
        if "last_rejection_reason" in context:
            parts.append(f"- Last Trade Rejection: {context['last_rejection_reason']}")
            
        return "\n".join(parts)
    
    async def analyze_trade(self, trade_data: Dict[str, Any]) -> str:
        """Analyze a specific trade and explain the decision."""
        prompt = f"""Analyze this trade decision:
        
Action: {trade_data.get('action', 'Unknown')}
Symbol: {trade_data.get('symbol', 'Unknown')}
Entry Price: {trade_data.get('entry_price', 'N/A')}
Stop Loss: {trade_data.get('sl', 'N/A')}
Take Profit: {trade_data.get('tp', 'N/A')}
Confidence: {trade_data.get('confidence', 'N/A')}%
Strategy: {trade_data.get('strategy', 'Unknown')}
RSI at Entry: {trade_data.get('rsi', 'N/A')}
Trend: {trade_data.get('trend', 'N/A')}

Explain why this trade was taken and assess its quality."""
        
        return await self.chat(prompt)
    
    async def explain_rejection(self, rejection_data: Dict[str, Any]) -> str:
        """Explain why a trade was rejected."""
        prompt = f"""Explain why this trade signal was rejected:

Symbol: {rejection_data.get('symbol', 'Unknown')}
Attempted Direction: {rejection_data.get('direction', 'Unknown')}
Rejection Reason: {rejection_data.get('reason', 'Unknown')}
Current RSI: {rejection_data.get('rsi', 'N/A')}
Current ADX: {rejection_data.get('adx', 'N/A')}
MA Slope: {rejection_data.get('ma_slope', 'N/A')}
Strategy Thresholds:
- Sideways Slope Threshold: {rejection_data.get('sideways_threshold', 'N/A')}
- ADX Threshold: {rejection_data.get('adx_threshold', 'N/A')}

Explain in simple terms why the bot didn't take this trade and whether this was a good decision."""
        
        return await self.chat(prompt)
    
    def clear_history(self):
        """Clear conversation history."""
        self.conversation_history = []
        logger.info("AI Assistant conversation history cleared")


# Global instance
ai_assistant = AIAssistant()
